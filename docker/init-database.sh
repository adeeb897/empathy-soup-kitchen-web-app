#!/bin/bash

# Wait for SQL Server to be ready
echo "Waiting for SQL Server to be ready..."
until docker exec empathy-sqlserver /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Password123!" -Q "SELECT 1" > /dev/null 2>&1; do
  echo "SQL Server is unavailable - sleeping"
  sleep 1
done

echo "SQL Server is ready!"

# Run initialization scripts
echo "Running database initialization scripts..."

for script in /home/adeeb897/empathy-soup-kitchen-web-app/docker/sql-init/*.sql; do
    echo "Executing $script..."
    docker exec -i empathy-sqlserver /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Password123!" < "$script"
    if [ $? -eq 0 ]; then
        echo "Successfully executed $script"
    else
        echo "Error executing $script"
        exit 1
    fi
done

echo "Database initialization completed!"