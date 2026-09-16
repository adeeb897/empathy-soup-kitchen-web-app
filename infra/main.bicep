@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Name of the existing Static Web App')
param swaName string = 'empathy-soup-kitchen-web-app'

@description('SQL Server administrator login')
param sqlAdminLogin string = 'sqladmin'

@description('SQL Server administrator password')
@secure()
param sqlAdminPassword string

@description('Object ID of the deploying user (for Key Vault access)')
param deployingUserObjectId string

@description('Unique suffix for globally-unique resource names')
param uniqueSuffix string = uniqueString(resourceGroup().id)

@description('Forces the schema script to re-run on every deployment')
param deploymentTime string = utcNow()

// ─── Key Vault ──────────────────────────────────────────────────────
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'empathy-kv-${uniqueSuffix}'
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: deployingUserObjectId
        permissions: {
          secrets: ['get', 'list', 'set']
        }
      }
    ]
    enableRbacAuthorization: false
    enabledForTemplateDeployment: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
  }
}

resource sqlPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'sql-admin-password'
  properties: {
    value: sqlAdminPassword
  }
}

// ─── Azure SQL Server ───────────────────────────────────────────────
resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: 'empathy-sql-${uniqueSuffix}'
  location: location
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

// Allow Azure services to connect
resource sqlFirewallAzure 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// ─── Azure SQL Database (free tier) ─────────────────────────────────
resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: 'empathy-db'
  location: location
  sku: {
    name: 'GP_S_Gen5_2'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 2
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 34359738368 // 32 GB
    autoPauseDelay: 60
    minCapacity: json('0.5')
    useFreeLimit: true
    freeLimitExhaustionBehavior: 'AutoPause'
  }
}

// ─── Apply database schema ──────────────────────────────────────────
// Runs infra/sql-setup.sql against the database on every deployment.
// The SQL is idempotent (every object is guarded), so re-running is a
// no-op once the schema is current — that is what makes this safe to
// wire into the deployment at all.
//
// loadTextContent() inlines the .sql file at compile time, so the script
// and the schema can never drift apart.
resource runSchema 'Microsoft.Resources/deploymentScripts@2023-08-01' = {
  name: 'apply-sql-schema'
  location: location
  kind: 'AzurePowerShell'
  properties: {
    azPowerShellVersion: '11.5'
    // Re-run whenever the deployment runs, so new tables land automatically.
    forceUpdateTag: deploymentTime
    retentionInterval: 'PT1H'
    cleanupPreference: 'OnSuccess'
    timeout: 'PT30M'
    environmentVariables: [
      {
        name: 'SQL_SERVER'
        value: sqlServer.properties.fullyQualifiedDomainName
      }
      {
        name: 'SQL_DATABASE'
        value: sqlDatabase.name
      }
      {
        name: 'SQL_USER'
        value: sqlAdminLogin
      }
      {
        name: 'SQL_PASSWORD'
        secureValue: sqlAdminPassword
      }
      {
        name: 'SQL_SCRIPT'
        value: loadTextContent('sql-setup.sql')
      }
    ]
    scriptContent: '''
      $ErrorActionPreference = 'Stop'

      $connectionString = "Server=tcp:$($env:SQL_SERVER),1433;Initial Catalog=$($env:SQL_DATABASE);User ID=$($env:SQL_USER);Password=$($env:SQL_PASSWORD);Encrypt=True;TrustServerCertificate=False;Connection Timeout=60;"

      # The database is serverless with auto-pause, so the first connection
      # after an idle period can fail while it resumes. Retry with backoff.
      $connection = New-Object System.Data.SqlClient.SqlConnection $connectionString
      $maxAttempts = 10
      for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        try {
          $connection.Open()
          Write-Output "Connected on attempt $attempt."
          break
        } catch {
          if ($attempt -eq $maxAttempts) { throw }
          Write-Output "Connect attempt $attempt failed (database may be resuming); retrying in 30s..."
          Start-Sleep -Seconds 30
        }
      }

      try {
        # Split on GO batch separators so the file can use them if needed.
        $batches = [System.Text.RegularExpressions.Regex]::Split(
          $env:SQL_SCRIPT, '(?im)^[\t ]*GO[\t ]*(?:--.*)?$'
        ) | Where-Object { $_.Trim() -ne '' }

        foreach ($batch in $batches) {
          $command = $connection.CreateCommand()
          $command.CommandText = $batch
          $command.CommandTimeout = 300
          [void]$command.ExecuteNonQuery()
        }

        # Report what exists now, so the deployment output is verifiable.
        $check = $connection.CreateCommand()
        $check.CommandText = "SELECT name FROM sys.tables ORDER BY name"
        $reader = $check.ExecuteReader()
        $tables = @()
        while ($reader.Read()) { $tables += $reader.GetString(0) }
        $reader.Close()

        Write-Output "Schema applied. Tables: $($tables -join ', ')"
        $DeploymentScriptOutputs = @{ tables = $tables }
      } finally {
        $connection.Close()
      }
    '''
  }
}

// ─── Reference existing Static Web App ──────────────────────────────
resource swa 'Microsoft.Web/staticSites@2023-12-01' existing = {
  name: swaName
}

// ─── Enable system-assigned managed identity on SWA ─────────────────
resource swaIdentity 'Microsoft.Web/staticSites@2023-12-01' = {
  name: swaName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {}
}

// ─── Set SWA managed identity as SQL AD admin ───────────────────────
resource sqlAdAdmin 'Microsoft.Sql/servers/administrators@2023-08-01-preview' = {
  parent: sqlServer
  name: 'ActiveDirectory'
  properties: {
    administratorType: 'ActiveDirectory'
    login: swaName
    sid: swaIdentity.identity.principalId
    tenantId: swaIdentity.identity.tenantId
  }
}

// ─── Link database to SWA ───────────────────────────────────────────
resource dbConnection 'Microsoft.Web/staticSites/databaseConnections@2023-12-01' = {
  parent: swa
  name: 'default'
  dependsOn: [swaIdentity, sqlAdAdmin]
  properties: {
    resourceId: sqlDatabase.id
    connectionIdentity: 'SystemAssigned'
    connectionString: 'Server=tcp:${sqlServer.name}${environment().suffixes.sqlServerHostname},1433;Database=${sqlDatabase.name};Encrypt=true;TrustServerCertificate=false;Connection Timeout=30;'
    region: location
  }
}

// ─── Logic App: Hourly Reminder Scheduler ────────────────────────────
resource reminderScheduler 'Microsoft.Logic/workflows@2019-05-01' = {
  name: 'empathy-reminder-scheduler'
  location: location
  properties: {
    state: 'Enabled'
    definition: {
      '$schema': 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#'
      contentVersion: '1.0.0.0'
      triggers: {
        Recurrence: {
          type: 'Recurrence'
          recurrence: {
            frequency: 'Hour'
            interval: 1
          }
        }
      }
      actions: {
        Send_Reminders: {
          type: 'Http'
          inputs: {
            method: 'POST'
            uri: 'https://${swa.properties.defaultHostname}/api/reminders/process'
            headers: {
              'Content-Type': 'application/json'
            }
            body: {}
          }
        }
      }
    }
  }
}

// ─── Outputs ────────────────────────────────────────────────────────
output keyVaultName string = keyVault.name
output sqlServerName string = sqlServer.name
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output databaseName string = sqlDatabase.name
output swaDefaultHostname string = swa.properties.defaultHostname
output reminderSchedulerName string = reminderScheduler.name
output schemaTables array = runSchema.properties.outputs.tables
