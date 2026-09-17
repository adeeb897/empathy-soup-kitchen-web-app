# Empathy Soup Kitchen Web Application

Angular 21 website for [Empathy Soup Kitchen](https://empathysoupkitchen.org), a nonprofit serving meals in McKeesport, PA.

## Architecture

- **Frontend:** Angular 21 standalone components, custom CSS design system (no UI library)
- **Hosting:** Azure Static Web Apps (Standard tier)
- **Database:** Azure SQL (Basic, 5 DTU)
- **Data access:** Azure Functions in `api/`, deployed as SWA managed functions.
  These hold the only database connection string and authorise every write.
  There is no Data API Builder endpoint — see "Why there is no `/data-api`".
- **CI/CD:** GitHub Actions → Azure SWA auto-deploy on push to `main`

## Project Structure

```
src/app/
├── pages/
│   ├── home/                 # Landing page with hero, stats, hours
│   ├── volunteer/            # Shift signup + emailed cancellation links
│   ├── admin/                # Admin panel (magic link + signed session token)
│   │   ├── shifts/           # Create/edit shifts, view signups
│   │   ├── pledges/          # Submitted pledges + cumulative totals
│   │   └── settings/         # Editable site text
│   ├── pledge/               # Public pledge form
│   ├── fundraiser/           # Annual fundraiser details + ticket link
│   ├── financial-report/     # Quarterly PDFs + updates link
│   ├── get-involved/         # Donate, refugee services
│   ├── gallery/              # Masonry photo gallery with lightbox
│   └── about/                # Mission, board, FAQ, contact
├── shared/
│   ├── components/           # Navbar, Footer, ScrollAnimate directive
│   ├── services/             # ModalService, ToastService, ApiWarmupService
│   └── utils/                # RetryService, magic-link token capture
└── pages/calendar/
    ├── models/               # VolunteerShift, SignUp interfaces
    └── services/             # VolunteerShiftService, TextBoxService, AdminAuthService
api/                          # Azure Functions — the only database clients
├── shifts/                   # Shift CRUD (writes are admin-only)
├── signups/                  # Signup create/cancel; PII is admin-only
├── pledges/                  # Pledge submit (public) + list (admin-only)
├── textboxes/                # Editable site text
├── cancel-links/             # Emails signed cancellation links
├── auth-magic-link/          # Sends an admin sign-in link
├── auth-verify-magic/        # Exchanges that link for a session token
├── send-email/               # Confirmation email
├── send-reminders/           # Called hourly by the Logic App
└── shared/                   # db, http, auth, email, cancel-token helpers
infra/
├── main.bicep                # Full stack: Key Vault, SQL, Logic App
├── database.bicep            # SQL server + database (used by CI and by main.bicep)
├── schema.bicep              # Applies sql-setup.sql (used by CI and by main.bicep)
├── sql-setup.sql             # Table schemas (VolunteerShifts, SignUps, TextBoxes, Pledges)
└── parameters.json           # Deployment parameter template
```

## Database Schema

Defined in `infra/sql-setup.sql`.

| Table | Key Columns |
|-------|------------|
| `dbo.VolunteerShifts` | ShiftID, StartTime, EndTime, Capacity |
| `dbo.SignUps` | SignUpID, ShiftID (FK), Name, Email, PhoneNumber, NumPeople, ReminderSent |
| `dbo.TextBoxes` | ID, TextName (unique), TextContent |
| `dbo.Pledges` | PledgeID, Amount, Name, Email, PhoneNumber, Address, Frequency, PaymentMethod, SubmittedAt |

### Database changes

Database changes are applied **automatically on merge to `main`**. The
`apply_schema_job` in the CI workflow deploys, in order:

1. `infra/database.bicep` — the SQL server and database themselves: service tier,
   size, firewall, server settings.
2. `infra/schema.bicep` — executes `infra/sql-setup.sql` against that database.

There is no manual step and no separate migration tool.

Both templates deliberately touch **only** the database, so applying a database
change never redeploys the Static Web App, Key Vault or Logic App — that is both
unnecessary and, for `Microsoft.Web/staticSites`, fails preflight. `main.bicep`
consumes both as modules, so there is exactly one definition of each.

To add or change a table: edit `infra/sql-setup.sql`. To change the service tier or
another database setting: edit `infra/database.bicep`. Either way, open a PR and merge
it. The job:

- runs **only on merges to `main`**, never on PRs
- runs **only when something under `infra/` changed** — app-only merges skip it
- runs **before** the app deploys, so new code never goes live against a database that is
  missing its tables. If the step fails, the app deploy is blocked.

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

### Admin access

Someone is an admin if **either** is true:

- their address is at a domain in `ADMIN_EMAIL_DOMAINS` (defaults to
  `empathysoupkitchen.org`), or
- their address is listed explicitly in `ADMIN_EMAILS`

The explicit list is for admins outside the org domain. Both are checked on
every request, so removing someone takes effect immediately rather than when
their session expires.

| Setting | Purpose |
|---------|---------|
| `ADMIN_EMAIL_DOMAINS` | Comma-separated domains whose addresses are admins. Set to an empty string to require the explicit list only. |
| `ADMIN_EMAILS` | Comma-separated individual addresses. |

Domains are matched exactly against the part after the last `@`, so a
lookalike (`user@evil-empathysoupkitchen.org`) or a subdomain
(`user@mail.empathysoupkitchen.org`) does not qualify.

**Anyone who can receive mail at an admin domain can sign in**, which
includes shared aliases and accounts belonging to people who have left. A
catch-all address on the domain would effectively make the admin open to
anyone, so make sure the domain has none.

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

## Why Angular 21 and not 22

Angular 22 requires Node `>=22.22.3`. Azure Static Web Apps builds this app with
Oryx, and Oryx installs **Node 22.22.0** — three patch versions short — so an
upgrade to 22 builds locally and then fails in CI.

There is nothing to gain by forcing it. Angular 21 is supported, and `npm audit`
reports zero vulnerabilities on it. Revisit when Oryx ships a newer Node; the
version it picks is printed in the deploy log under `Using Node version:`.

The build, serve, extract-i18n and test targets all use `@angular/build` rather
than `@angular-devkit/build-angular`. The latter is the compatibility package
and pulls in the whole webpack and karma dependency tree — which is where every
remaining advisory came from after the framework upgrade. Do not switch back.

## Why there is no `/data-api`

The site used to deploy **Data API Builder** alongside the app, via a
`swa-db-connections/` config folder and `data_api_location` in the workflow. Its
config granted the `anonymous` role `["*"]` — full read, insert, update and
delete — on `SignUps`, `VolunteerShifts` and `TextBoxes`, with GraphQL
introspection on and CORS `*`. Had it been connected to the database, anyone who
knew the URL could have read every volunteer's name, email and phone number, or
emptied the shift table, without authenticating.

**It was never connected.** Checked on 2026-09-17: the Static Web App had no
database connection, so `/data-api/rest/SignUps` answered
`Data API call failure` (HTTP 500) rather than serving rows, and no volunteer
data was ever reachable this way.

```
$ az staticwebapp dbconnection show --name empathy-soup-kitchen-web-app \
    --resource-group empathy-soup-kitchen-web-app
Not Found: Cannot find DatabaseConnection with name default.
```

What made it worth removing is that `main.bicep` *declared* that connection. Any
full `main.bicep` deployment would have created it, and the `anonymous: ["*"]`
config would have gone live serving everything — a latent trapdoor rather than an
open one. Both halves are now gone: the config, the workflow setting, the route
exclusion, the docker-compose service, and the `databaseConnections` resource.

Nothing in the app ever called it. All data access goes through `api/`, which
checks authorisation on every write.

**Do not add `data_api_location` back.** If a future feature wants a direct data
API, it needs per-entity permissions tied to real roles, not `anonymous: ["*"]`,
and the tables holding volunteer contact details should not be among them.

If a connection is ever linked again and needs removing, note that Bicep will not
delete it for you — it never deletes what it stops declaring:

```bash
az staticwebapp dbconnection delete \
  --name empathy-soup-kitchen-web-app \
  --resource-group empathy-soup-kitchen-web-app
```

Once this change is deployed, the route should be gone entirely:

```bash
# expect 404
curl -s -o /dev/null -w '%{http_code}\n' \
  https://empathysoupkitchen.org/data-api/rest/SignUps
```

## Infrastructure Deployment

Requires [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli).

```bash
# 1. Login
az login

# 2. Deploy Azure SQL + apply the database schema
az deployment group create \
  --resource-group empathy-soup-kitchen-web-app \
  --template-file infra/main.bicep \
  --parameters sqlAdminPassword='<STRONG_PASSWORD>'
```

Step 2 also applies `infra/sql-setup.sql` — `main.bicep` includes `schema.bicep` as a
module, so the tables are created as part of the same deployment. It is idempotent.

To apply **only** the database configuration (service tier, firewall, server
settings), without redeploying any other infrastructure:

```bash
RG=empathy-soup-kitchen-web-app
KV=$(az keyvault list -g $RG --query "[0].name" -o tsv)

az deployment group create \
  --resource-group $RG \
  --template-file infra/database.bicep \
  --parameters location="$(az group show -n $RG --query location -o tsv)" \
  --parameters sqlServerName="$(az sql server list -g $RG --query "[0].name" -o tsv)" \
  --parameters sqlAdminLogin=sqladmin \
  --parameters sqlAdminPassword="$(az keyvault secret show --vault-name $KV --name sql-admin-password --query value -o tsv)"
```

To apply **only** a schema change:

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

CI runs both of these on merge, in that order, whenever a push to `main` touches
`infra/`. `main.bicep` is deliberately not what CI deploys: it redeploys the
Static Web App too, which fails preflight (see #35). Both smaller templates
declare zero `Microsoft.Web` resources.

Verify what landed via the deployment output:

```bash
az deployment group show \
  --resource-group empathy-soup-kitchen-web-app \
  --name main \
  --query properties.outputs.schemaTables.value
```

The Bicep template provisions:
- Azure SQL Server (TLS 1.2, Azure services firewall rule)
- Azure SQL Database (Basic tier, 5 DTU, always on)
- SWA database connection (auto-sets `DATABASE_CONNECTION_STRING`)

Changing the service tier scales the existing database in place: the data is
preserved, but connections drop for a few seconds while the change applies. CI
applies this on merge, so merge tier changes outside serving hours. The database
must fit inside the tier's size limit (2 GB on Basic).

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
| `npm run db:start` | Start the local SQL Server container |
| `npm run db:stop` | Stop database containers |
| `npm run db:reset` | Reset database (deletes all data) |
| `npm run db:logs` | View database container logs |
| `ng serve` | Dev server only (no local DB) at `http://localhost:4200/` |
| `ng build` | Production build → `dist/empathy-soup-kitchen-web-app/browser` |
| `ng test` | Run unit tests via Karma |
| `ng test --watch=false --browsers=ChromeHeadlessNoSandbox` | Same, inside a container (Chrome will not start as root without `--no-sandbox`) |
| `cd api && npm test` | Run the API tests (mailer, cancellation tokens, error shapes) |

The local dev server proxies `/api` to a local Azure Functions host at
`http://localhost:7071` (`cd api && npm start`, which needs the Azure Functions
Core Tools). Without it the page loads but every data call fails.

## Database Availability

The database runs on Azure SQL **Basic** (5 DTU, always on, ~$5/month) rather
than serverless on the free offer. Serverless auto-paused after an hour idle and
the first request afterwards waited 30-90 seconds for it to resume — longer than
the 45-second ceiling Static Web Apps puts on any API response, so the request
could not even wait it out. Basic removes that wait entirely.

The resume-handling code stays in place as a safety net for a restarted database
or a transient connection failure, and it is what keeps a bad minute from
looking like an outage:

- `GET /api/warmup` is a readiness probe. Touching the database is what triggers
  a resume, so the frontend calls it as soon as a visitor reaches for a link into
  the volunteer flow (nav link, home page CTA).
- `api/shared/db.js` retries transient logins inside a bounded budget, shares one
  connect attempt across concurrent requests, and tags an unavailable database so
  handlers answer `503` + `Retry-After` instead of `500`.
- `RetryService` retries those 503s. Writes only retry on 503 (raised before the
  query reaches SQL), never on 500, so a signup cannot be inserted twice.
- The volunteer page shows a "waking up the sign-up system" notice with a timer
  after 1.5 s and recovers on its own. On Basic it should never appear.

### If you ever move back to serverless

The free offer covers 100,000 vCore-seconds per month, which at `minCapacity`
0.5 is roughly **55 hours of awake time** — and `freeLimitExhaustionBehavior:
'AutoPause'` takes the database offline for the rest of the month once that runs
out. Anything touching the database on a schedule (the hourly reminder Logic App,
for one) keeps it awake and eats that budget, so the schedule has to be part of
the sum.

## Reminder Emails

The reminder Logic App calls `POST /api/reminders/process` hourly. Each run
emails every signup for a shift starting **3 to 26 hours** from now that has not
been reminded yet, then sets `ReminderSent`.

The window is much wider than the hourly schedule on purpose: `ReminderSent` is
what prevents duplicates, so a run that fails or is skipped is simply caught by
the next one instead of leaving those volunteers with no reminder at all. The
3-hour floor keeps someone who signs up the morning of a shift from getting a
"reminder" minutes later. Because a catch-up run can send on the day of the
shift, the email says "today" or "tomorrow" based on the actual date, in Eastern
time (`TIME_ZONE` in `api/send-reminders/index.js`) — shift times are stored in
UTC, and Azure Functions run in UTC, so the timezone has to be explicit.

## Troubleshooting

**Database containers won't start:** Ensure Docker is running. Wait 30s after `db:start` before connecting.

**Reset everything:** `npm run db:reset && sleep 30`

**Azure Data API returning 500:** Check that the database connection is linked in Azure Portal (Static Web App → Database connection) and that `DATABASE_CONNECTION_STRING` is set in environment variables.
