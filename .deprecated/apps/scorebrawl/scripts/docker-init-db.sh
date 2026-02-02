#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE "scorebrawl-e2e";
    GRANT ALL PRIVILEGES ON DATABASE "scorebrawl-e2e" TO $POSTGRES_USER;
EOSQL

echo "Database 'scorebrawl-e2e' created successfully!"
