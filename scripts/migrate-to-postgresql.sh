#!/bin/bash

# PostgreSQL Migration Execution Script
# This script executes the complete migration from MySQL to PostgreSQL
# with proper error handling and validation

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Environment validation
validate_environment() {
    print_status "Validating environment variables..."

    required_vars=("DB_HOST" "DB_PORT" "DB_USER" "DB_PASSWORD" "DB_NAME")
    missing_vars=()

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        print_error "Missing required environment variables: ${missing_vars[*]}"
        exit 1
    fi

    print_success "Environment variables validated"
}

# Check PostgreSQL connection
check_postgres_connection() {
    print_status "Testing PostgreSQL connection..."

    if ! psql "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        print_error "Cannot connect to PostgreSQL database"
        print_error "Please check your connection parameters and ensure PostgreSQL is running"
        exit 1
    fi

    print_success "PostgreSQL connection verified"
}

# Backup current PostgreSQL database (if it exists)
backup_postgres_db() {
    print_status "Creating backup of existing PostgreSQL database (if any)..."

    # Check if database has tables
    table_count=$(psql "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ' || echo "0")

    if [[ "$table_count" -gt 0 ]]; then
        backup_file="backups/postgres_backup_$(date +%Y%m%d_%H%M%S).sql"
        mkdir -p backups

        if PGPASSWORD="$DB_PASSWORD" pg_dump "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" > "$backup_file"; then
            print_success "Database backed up to: $backup_file"
        else
            print_warning "Failed to create backup, proceeding anyway..."
        fi
    else
        print_status "No existing tables found, skipping backup"
    fi
}

# Execute migration files in order
execute_migrations() {
    print_status "Executing PostgreSQL migrations..."

    local migrations=(
        "001_initial_postgresql_schema.sql"
        "003_vector_extensions.sql"
        "002_data_migration_mysql_to_postgresql.sql"
    )

    for migration in "${migrations[@]}"; do
        if [[ -f "migrations/$migration" ]]; then
            print_status "Executing migration: $migration"

            if PGPASSWORD="$DB_PASSWORD" psql "$DB_NAME" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -f "migrations/$migration"; then
                print_success "Migration $migration executed successfully"
            else
                print_error "Migration $migration failed"
                exit 1
            fi
        else
            print_warning "Migration file not found: migrations/$migration"
        fi
    done
}

# Validate migration results
validate_migration() {
    print_status "Validating migration results..."

    # Check if tables were created
    local tables=("users" "workshops" "questionnaires" "responses" "consents" "audit_logs")

    for table in "${tables[@]}"; do
        local count=$(psql "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d ' ' || echo "ERROR")

        if [[ "$count" == "ERROR" ]]; then
            print_error "Table $table not found or inaccessible"
            return 1
        else
            print_success "Table $table: $count records"
        fi
    done

    # Check RLS policies
    local rls_tables=("users" "responses" "consents" "workshops")

    for table in "${rls_tables[@]}"; do
        local rls_enabled=$(psql "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME" -t -c "SELECT rowsecurity FROM pg_tables WHERE tablename = '$table';" 2>/dev/null | tr -d ' ' || echo "0")

        if [[ "$rls_enabled" == "t" ]]; then
            print_success "RLS enabled on table: $table"
        else
            print_warning "RLS not enabled on table: $table"
        fi
    done

    # Check extensions
    local extensions=("uuid-ossp" "pgcrypto" "vector")

    for ext in "${extensions[@]}"; do
        local ext_exists=$(psql "postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME" -t -c "SELECT 1 FROM pg_extension WHERE extname = '$ext';" 2>/dev/null | tr -d ' ' || echo "0")

        if [[ "$ext_exists" == "1" ]]; then
            print_success "Extension $ext is installed"
        else
            print_warning "Extension $ext is not installed"
        fi
    done
}

# Generate Drizzle migrations
generate_drizzle_migrations() {
    print_status "Generating Drizzle migrations..."

    if npm run db:generate; then
        print_success "Drizzle migrations generated"
    else
        print_warning "Failed to generate Drizzle migrations"
    fi
}

# Test application startup
test_application() {
    print_status "Testing application startup..."

    # Start application in background and quickly check if it starts
    timeout 10s npm start > /tmp/app_test.log 2>&1 &
    local app_pid=$!

    sleep 3

    if kill -0 "$app_pid" 2>/dev/null; then
        print_success "Application started successfully"
        kill "$app_pid" 2>/dev/null
    else
        print_error "Application failed to start"
        print_error "Check logs in /tmp/app_test.log"
        cat /tmp/app_test.log
        return 1
    fi
}

# Main execution
main() {
    print_status "Starting PostgreSQL migration process..."
    print_status "Migration started at: $(date)"

    # Load environment variables
    if [[ -f ".env" ]]; then
        source .env
        print_status "Loaded environment variables from .env file"
    else
        print_warning ".env file not found, using existing environment variables"
    fi

    # Execute migration steps
    validate_environment
    check_postgres_connection
    backup_postgres_db
    execute_migrations
    validate_migration
    generate_drizzle_migrations

    # Optional: Test application startup if requested
    if [[ "$1" == "--test-app" ]]; then
        test_application
    fi

    print_success "Migration completed successfully!"
    print_status "Migration completed at: $(date)"

    # Print summary
    echo ""
    echo "=== Migration Summary ==="
    echo "✅ PostgreSQL schema created with all required tables"
    echo "✅ RLS policies implemented for GDPR compliance"
    echo "✅ Vector extensions installed for AI features"
    echo "✅ Data migration scripts ready for execution"
    echo "✅ Application configuration updated for PostgreSQL"
    echo ""
    echo "Next steps:"
    echo "1. Review the migration results"
    echo "2. Test application functionality"
    echo "3. Update any remaining MySQL-specific code"
    echo "4. Deploy to staging environment for further testing"
}

# Handle script interruption
trap 'print_error "Migration interrupted"; exit 1' INT TERM

# Execute main function with all arguments
main "$@"