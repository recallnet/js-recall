#!/bin/bash

echo "=== Drizzle Migration Duplicate Check ==="
echo "Working directory: apps/api"
cd apps/api

# First check for duplicate migration prefixes
echo "Checking for duplicate migration prefixes..."

# Get all migration files with 4-digit prefixes
migration_files=$(ls drizzle/*.sql 2>/dev/null | grep -E '^drizzle/[0-9]{4}_.*\.sql$' | sort)

if [ -z "$migration_files" ]; then
  echo "No migration files found."
else
  # Extract prefixes and check for duplicates
  duplicate_prefixes=$(echo "$migration_files" | sed 's/^drizzle\/\([0-9]\{4\}\)_.*/\1/' | sort | uniq -d)
  
  if [ -n "$duplicate_prefixes" ]; then
    echo "::error::Duplicate migration prefixes found!"
    echo ""
    for prefix in $duplicate_prefixes; do
      echo "Duplicate prefix $prefix found in:"
      echo "$migration_files" | grep "^drizzle/${prefix}_" | sed 's/^/  - /'
    done
    echo ""
    echo "Each migration must have a unique 4-digit prefix."
    echo "One of these files is invalid. Please fix it and try again."
    exit 1
  else
    echo "✅ All migration prefixes are unique"
  fi
fi

echo "Generating migrations..."
  
# Generate migrations based on current schema and capture output
migration_output=$(pnpm db:gen-migrations 2>&1)
migration_exit_code=$?

echo "$migration_output"

# Check for specific error patterns in the output
if [[ $migration_exit_code -ne 0 ]] || echo "$migration_output" | grep -q "Error:" || echo "$migration_output" | grep -q "collision"; then
  echo "::error::Failed to generate database migrations. Please check your schema for errors or faulty migrations."
  echo "Migration output: $migration_output"
  exit 1
fi

# Check if there are any uncommitted changes
if [[ -n "$(git status --porcelain)" ]]; then
  echo "::error::Uncommitted migration files detected. Please run 'pnpm db:gen-migrations' locally and commit the generated files."
  git status
  exit 1
else
  echo "No uncommitted migration files detected."
fi

cd ../../
echo "Done."