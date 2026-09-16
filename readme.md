# Empathy Soup Kitchen Web Application

Angular 18 website for [Empathy Soup Kitchen](https://empathysoupkitchen.org), a nonprofit serving meals in the Atlanta area.

## Architecture

- **Frontend:** Angular 18 standalone components, custom CSS design system (no UI library)
- **Hosting:** Azure Static Web Apps (Standard tier)
- **Database:** Azure SQL (serverless, free tier) via Data API Builder (DAB)
- **CI/CD:** GitHub Actions → Azure SWA auto-deploy on push to `main`

## Project Structure

```
src/app/
├── pages/
│   ├── home/                 # Landing page with hero, stats, hours
│   ├── volunteer/            # Shift signup + cancellation
│   ├── volunteer-admin/      # Admin panel (OAuth-protected)
│   ├── get-involved/         # Donate, refugee services, financial reports
│   ├── gallery/              # Masonry photo gallery with lightbox
│   └── about/                # Mission, board, FAQ, contact
├── shared/
│   ├── components/           # Navbar, Footer, ScrollAnimate directive
│   └── services/             # ModalService, ToastService
└── pages/calendar/
    ├── models/               # VolunteerShift, SignUp interfaces
    └── services/             # VolunteerShiftService, TextBoxService, EmailService
infra/
├── main.bicep                # Azure SQL Server + Database + SWA DB link
├── schema.bicep              # Applies sql-setup.sql (used by CI and by main.bicep)
├── sql-setup.sql             # Table schemas (VolunteerShifts, SignUps, TextBoxes)
└── parameters.json           # Deployment parameter template
swa-db-connections/
└── staticwebapp.database.config.json  # DAB entity config
```

## Database Schema

Defined in `infra/sql-setup.sql`. Column names match the Angular service contracts exactly so DAB auto-maps without field overrides.

| Table | Key Columns |
|-------|------------|
| `dbo.VolunteerShifts` | ShiftID, StartTime, EndTime, Capacity |
| `dbo.SignUps` | SignUpID, ShiftID (FK), Name, Email, PhoneNumber, NumPeople, ReminderSent |
| `dbo.TextBoxes` | ID, TextName (unique), TextContent |
| `dbo.Pledges` | PledgeID, Amount, Name, Email, PhoneNumber, Address, Frequency, PaymentMethod, SubmittedAt |

### Schema changes

The schema is applied **automatically on merge to `main`**. The `apply_schema_job` in the
CI workflow deploys `infra/schema.bicep`, which executes `infra/sql-setup.sql` against
the database. There is no manual step and no separate migration tool.

`schema.bicep` deliberately touches **only** the database. It is kept separate from
`main.bicep` so that applying a schema change never redeploys the Static Web App, Key
Vault or Logic App — that is both unnecessary and, for `Microsoft.Web/staticSites`,
fails preflight. `main.bicep` consumes `schema.bicep` as a module, so there is exactly
one definition of how the schema is applied.

To add or change a table: edit `infra/sql-setup.sql`, open a PR, and merge it. The job:

- runs **only on merges to `main`**, never on PRs
- runs **only when something under `infra/` changed** — app-only merges skip it
- runs **before** the app deploys, so new code never goes live against a database that is
  missing its tables. If the schema step fails, the app deploy is blocked.

You can also apply it manually at any time with the command in
[Infrastructure Deployment](#infrastructure-deployment).

**Every statement must be idempotent.** The script re-runs in full on each deployment, so
guard new objects the way the existing ones are guarded:

```sql
IF OBJECT_ID('dbo.NewTable', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.NewTable ( ... );
END
GO
```

Separate statements with `GO`. Batches are executed in order, so anything that references
another object (a foreign key, an index) must come after the batch that creates it —
otherwise the deployment fails against a fresh database, even though it passes against one
where the tables already exist.

For column changes on an existing table, use a guarded `ALTER`:

```sql
IF COL_LENGTH('dbo.Pledges', 'NewColumn') IS NULL
    ALTER TABLE dbo.Pledges ADD NewColumn NVARCHAR(100) NULL;
GO
```

Local Docker databases get their schema from `docker/sql-init/01-create-database.sql`
instead, which needs the same change applied separately.

### CI setup for automatic schema deployment (one-time)

The workflow authenticates to Azure with **OIDC federated credentials** — no long-lived
secret is stored in GitHub. The SQL admin password is never stored in GitHub either: the
job reads it from Key Vault at run time and masks it from the logs.

```bash
RG=empathy-soup-kitchen-web-app
SUB=$(az account show --query id -o tsv)
REPO=adeeb897/empathy-soup-kitchen-web-app

# 1. App registration + service principal
APP_ID=$(az ad app create --display-name esk-github-deploy --query appId -o tsv)
az ad sp create --id "$APP_ID"

# 2. Trust GitHub Actions on main (and the CI environment, if you add one)
az ad app federated-credential create --id "$APP_ID" --parameters "{
  \"name\": \"github-main\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:${REPO}:ref:refs/heads/main\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}"

# 3. Let it deploy into the resource group
az role assignment create \
  --assignee "$APP_ID" \
  --role Contributor \
  --scope "/subscriptions/${SUB}/resourceGroups/${RG}"

echo "AZURE_CLIENT_ID=$APP_ID"
echo "AZURE_TENANT_ID=$(az account show --query tenantId -o tsv)"
echo "AZURE_SUBSCRIPTION_ID=$SUB"
```

Add those three values as GitHub **repository variables** (Settings → Secrets and
variables → Actions → *Variables* tab — not Secrets):

| Variable | Value |
|----------|-------|
| `AZURE_CLIENT_ID` | the app registration's client ID |
| `AZURE_TENANT_ID` | your Entra tenant ID |
| `AZURE_SUBSCRIPTION_ID` | the subscription holding the resource group |

**Also required:** the job reads the SQL password from Key Vault, which uses **access
policies** rather than RBAC — so Contributor alone is not enough. Grant it once:

```bash
KV=$(az keyvault list -g "$RG" --query "[0].name" -o tsv)
az keyvault set-policy --name "$KV" --spn "$APP_ID" --secret-permissions get list
```

Until the variables exist and this policy is granted, the schema job fails on merge and
blocks the app deploy — so do both before merging any change under `infra/`. The job
reports which of the two is missing in its summary.

## Infrastructure Deployment

Requires [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli).

```bash
# 1. Login
az login

# 2. Deploy Azure SQL + link to SWA + apply the database schema
az deployment group create \
  --resource-group empathy-soup-kitchen-web-app \
  --template-file infra/main.bicep \
  --parameters sqlAdminPassword='<STRONG_PASSWORD>'
```

Step 2 also applies `infra/sql-setup.sql` — `main.bicep` includes `schema.bicep` as a
module, so the tables are created as part of the same deployment. It is idempotent.

To apply **only** a schema change, without redeploying any other infrastructure:

```bash
RG=empathy-soup-kitchen-web-app
SQL_FQDN=$(az sql server list -g $RG --query "[0].fullyQualifiedDomainName" -o tsv)
KV=$(az keyvault list -g $RG --query "[0].name" -o tsv)

az deployment group create \
  --resource-group $RG \
  --template-file infra/schema.bicep \
  --parameters sqlServerFqdn="$SQL_FQDN" \
  --parameters sqlAdminPassword="$(az keyvault secret show --vault-name $KV --name sql-admin-password --query value -o tsv)"
```

This is what CI runs on merge.

Verify what landed via the deployment output:

```bash
az deployment group show \
  --resource-group empathy-soup-kitchen-web-app \
  --name main \
  --query properties.outputs.schemaTables.value
```

The Bicep template provisions:
- Azure SQL Server (TLS 1.2, Azure services firewall rule)
- Azure SQL Database (serverless Gen5, free tier, auto-pause at 60 min)
- SWA database connection (auto-sets `DATABASE_CONNECTION_STRING`)

## Local Development

### Prerequisites
- Node.js and npm
- Angular CLI (`npm install -g @angular/cli`)
- Docker and Docker Compose (for local database)

### Quick Start
```bash
# Start local database + dev server with API proxy
npm run dev
```

### Commands
| Command | Description |
|---------|------------|
| `npm run dev` | Start DB containers + Angular dev server with proxy |
| `npm run db:start` | Start SQL Server + DAB containers |
| `npm run db:stop` | Stop database containers |
| `npm run db:reset` | Reset database (deletes all data) |
| `npm run db:logs` | View database container logs |
| `ng serve` | Dev server only (no local DB) at `http://localhost:4200/` |
| `ng build` | Production build → `dist/empathy-soup-kitchen-web-app/browser` |
| `ng test` | Run unit tests via Karma |

The local dev server proxies `/data-api/rest/` calls to the local DAB instance at `http://localhost:5000`.

## Troubleshooting

**Database containers won't start:** Ensure Docker is running. Wait 30s after `db:start` before connecting.

**Reset everything:** `npm run db:reset && sleep 30`

**Azure Data API returning 500:** Check that the database connection is linked in Azure Portal (Static Web App → Database connection) and that `DATABASE_CONNECTION_STRING` is set in environment variables.
