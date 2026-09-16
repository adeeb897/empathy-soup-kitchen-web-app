// Azure SQL server and database, on their own so CI can apply database changes
// without redeploying the Static Web App, Key Vault or Logic App — the same
// reason schema.bicep exists. This template declares no Microsoft.Web
// resources, so it does not hit the staticSites preflight failure.

@description('Azure region for all resources')
param location string

@description('Name of the SQL logical server')
param sqlServerName string

@description('Name of the database')
param databaseName string = 'empathy-db'

@description('SQL Server administrator login')
param sqlAdminLogin string

@description('SQL Server administrator password')
@secure()
param sqlAdminPassword string

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: sqlServerName
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

// Basic (5 DTU, 2 GB) rather than serverless on the free offer: serverless
// auto-paused after an hour idle, so the first volunteer of the day waited
// 30-90 s for the database to resume — a wait Static Web Apps cannot even hold
// a request open for. Basic is always on for a flat ~$5/month, which for a few
// small tables of shifts, signups and pledges is the cheaper end of the trade.
//
// Note this gives up the free offer's 100,000 vCore-seconds per month, and its
// 'AutoPause' exhaustion behaviour that could have taken the site offline for
// the rest of a month.
resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: databaseName
  location: location
  sku: {
    name: 'Basic'
    tier: 'Basic'
    capacity: 5
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 2147483648 // 2 GB, the Basic tier maximum
  }
}

output sqlServerName string = sqlServer.name
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output databaseName string = sqlDatabase.name
output databaseId string = sqlDatabase.id
