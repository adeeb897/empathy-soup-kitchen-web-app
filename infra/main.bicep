@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Name of the existing Static Web App')
param swaName string = 'empathy-soup-kitchen-web-app'

@description('SQL Server administrator login')
param sqlAdminLogin string = 'sqladmin'

@description('SQL Server administrator password')
@secure()
param sqlAdminPassword string

@description('Unique suffix for globally-unique resource names')
param uniqueSuffix string = uniqueString(resourceGroup().id)

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
  dependsOn: [swaIdentity]
  properties: {
    resourceId: sqlDatabase.id
    connectionIdentity: 'SystemAssigned'
    connectionString: 'Server=tcp:${sqlServer.name}${environment().suffixes.sqlServerHostname},1433;Database=${sqlDatabase.name};User ID=${sqlAdminLogin};Password=${sqlAdminPassword};Encrypt=true;TrustServerCertificate=false;Connection Timeout=30;'
    region: location
  }
}

// ─── Outputs ────────────────────────────────────────────────────────
output sqlServerName string = sqlServer.name
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output databaseName string = sqlDatabase.name
output swaDefaultHostname string = swa.properties.defaultHostname
