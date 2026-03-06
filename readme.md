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

## Infrastructure Deployment

Requires [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli).

```bash
# 1. Login
az login

# 2. Deploy Azure SQL + link to SWA
az deployment group create \
  --resource-group empathy-soup-kitchen-web-app \
  --template-file infra/main.bicep \
  --parameters sqlAdminPassword='<STRONG_PASSWORD>'

# 3. Create tables (use Azure Portal Query Editor or sqlcmd)
#    Run the contents of infra/sql-setup.sql against the new database
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
