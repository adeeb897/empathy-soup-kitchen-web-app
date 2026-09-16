// ============================================
// Database schema deployment (standalone)
//
// Applies infra/sql-setup.sql to an EXISTING database and touches nothing
// else. CI deploys this on merge rather than main.bicep, so applying a
// schema change never redeploys the Static Web App, Key Vault or Logic App.
//
// main.bicep consumes this same file as a module, so there is exactly one
// definition of how the schema gets applied.
// ============================================

@description('Azure region for the deployment script resources')
param location string = resourceGroup().location

@description('Fully-qualified domain name of the SQL server')
param sqlServerFqdn string

@description('Name of the database to apply the schema to')
param databaseName string = 'empathy-db'

@description('SQL Server administrator login')
param sqlAdminLogin string = 'sqladmin'

@description('SQL Server administrator password')
@secure()
param sqlAdminPassword string

@description('Forces the schema script to re-run on every deployment')
param deploymentTime string = utcNow()

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
        value: sqlServerFqdn
      }
      {
        name: 'SQL_DATABASE'
        value: databaseName
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

output schemaTables array = runSchema.properties.outputs.tables
