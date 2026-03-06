#!/bin/bash

# Start SQL Server in the background
/opt/mssql/bin/sqlservr &
MSSQL_PID=$!

# Wait for SQL Server to accept connections
echo "Waiting for SQL Server to start..."
for i in {1..60}; do
    /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$SA_PASSWORD" -Q "SELECT 1" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "SQL Server is ready."
        break
    fi
    sleep 1
done

# Run all SQL init scripts
for script in /sql-init/*.sql; do
    if [ -f "$script" ]; then
        echo "Executing $script..."
        /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "$SA_PASSWORD" -i "$script"
        if [ $? -eq 0 ]; then
            echo "Successfully executed $script"
        else
            echo "Error executing $script"
            exit 1
        fi
    fi
done

echo "Database initialization completed."

# Wait for SQL Server process
wait $MSSQL_PID
