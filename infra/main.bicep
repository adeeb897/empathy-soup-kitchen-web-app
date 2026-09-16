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

// ─── Azure SQL server and database ──────────────────────────────────
// Declared in database.bicep so CI can apply database changes on its own,
// without redeploying the Static Web App (whose preflight fails) alongside
// them. Deploying main.bicep still applies the same definition.
var sqlServerName = 'empathy-sql-${uniqueSuffix}'

module database 'database.bicep' = {
  name: 'sql-database'
  params: {
    location: location
    sqlServerName: sqlServerName
    sqlAdminLogin: sqlAdminLogin
    sqlAdminPassword: sqlAdminPassword
  }
}

// Reference to the server the module creates, so its AD admin can be declared
// here as a child resource.
resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' existing = {
  name: sqlServerName
}

// ─── Apply database schema ──────────────────────────────────────────
// Runs infra/sql-setup.sql against the database on every deployment.
// The SQL is idempotent (every object is guarded), so re-running is a
// no-op once the schema is current — that is what makes this safe to
// wire into the deployment at all.
//
// loadTextContent() inlines the .sql file at compile time, so the script
// and the schema can never drift apart.
module schema 'schema.bicep' = {
  name: 'apply-sql-schema'
  params: {
    location: location
    sqlServerFqdn: database.outputs.sqlServerFqdn
    databaseName: database.outputs.databaseName
    sqlAdminLogin: sqlAdminLogin
    sqlAdminPassword: sqlAdminPassword
    deploymentTime: deploymentTime
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
  dependsOn: [database]
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
    resourceId: database.outputs.databaseId
    connectionIdentity: 'SystemAssigned'
    connectionString: 'Server=tcp:${sqlServerName}${environment().suffixes.sqlServerHostname},1433;Database=${database.outputs.databaseName};Encrypt=true;TrustServerCertificate=false;Connection Timeout=30;'
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
output sqlServerName string = database.outputs.sqlServerName
output sqlServerFqdn string = database.outputs.sqlServerFqdn
output databaseName string = database.outputs.databaseName
output swaDefaultHostname string = swa.properties.defaultHostname
output reminderSchedulerName string = reminderScheduler.name
output schemaTables array = schema.outputs.schemaTables
