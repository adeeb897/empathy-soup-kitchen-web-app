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

The schema is applied **automatically** by a Bicep `deploymentScript` (`runSchema` in
`main.bicep`) on every `az deployment group create` — there is no manual step and no
separate migration tool.

To add or change a table, edit `infra/sql-setup.sql` and re-run the deployment command
from [Infrastructure Deployment](#infrastructure-deployment).

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

Step 2 also applies `infra/sql-setup.sql` — the `runSchema` deployment script runs it
against the database as part of the same deployment, so there is no separate step to
create tables. Re-run the same command after editing the schema; it is idempotent.

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
