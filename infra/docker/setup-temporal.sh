#!/bin/sh
set -eu

: "${SQL_PASSWORD:?local Temporal database credential required}"
for database in temporal temporal_visibility; do
  if temporal-sql-tool --plugin postgres12 --ep temporal-db -u temporal -p 5432 --db "$database" read-schema-version >/dev/null 2>&1; then
    echo "Temporal schema present: $database"
  else
    if [ "$database" = temporal_visibility ]; then
      temporal-sql-tool --plugin postgres12 --ep temporal-db -u temporal -p 5432 --db "$database" create
    fi
    temporal-sql-tool --plugin postgres12 --ep temporal-db -u temporal -p 5432 --db "$database" setup-schema -v 0.0
  fi
  if [ "$database" = temporal_visibility ]; then
    schema_path=/etc/temporal/schema/postgresql/v12/visibility/versioned
  else
    schema_path=/etc/temporal/schema/postgresql/v12/temporal/versioned
  fi
  temporal-sql-tool --plugin postgres12 --ep temporal-db -u temporal -p 5432 --db "$database" update-schema -d "$schema_path"
  echo "Temporal schema current: $database"
done
