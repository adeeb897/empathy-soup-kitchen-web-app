# Empathy Soup Kitchen Web Application

## Local Development Setup

### Prerequisites
- Docker and Docker Compose
- Node.js and npm
- Angular CLI (`npm install -g @angular/cli`)

### Quick Start with Database
```bash
# Start complete development environment (database + app)
npm run dev
```

### Database Management Commands
- `npm run db:start` - Start SQL Server and Data API Builder containers
- `npm run db:stop` - Stop database containers  
- `npm run db:reset` - Reset database (deletes all data)
- `npm run db:init` - Initialize database with sample data
- `npm run db:logs` - View database container logs

### Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

**With local database:** The app is configured to proxy API calls to the local Data API Builder at `http://localhost:5000/data-api/rest/`

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Database Troubleshooting

If you encounter database connection issues:
1. Ensure Docker is running
2. Wait 30 seconds after `db:start` before running `db:init`  
3. Reset everything: `npm run db:reset && sleep 30 && npm run db:init`
4. Check container status: `docker ps`

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
