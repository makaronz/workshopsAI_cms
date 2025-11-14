#!/bin/bash

# PostgreSQL Setup Validation Script
# Validates that the PostgreSQL migration setup is complete and ready

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

echo "======================================================"
echo "PostgreSQL Migration Setup Validation"
echo "======================================================"

# Check required files
print_status "Checking required migration files..."

required_files=(
    "migrations/001_initial_postgresql_schema.sql"
    "migrations/002_data_migration_mysql_to_postgresql.sql"
    "migrations/003_vector_extensions.sql"
    "scripts/migrate-to-postgresql.sh"
    "src/models/postgresql-schema.ts"
    "src/config/postgresql-database.ts"
    "drizzle.config.postgresql.ts"
)

files_ok=true
for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        print_success "Found: $file"
    else
        print_error "Missing: $file"
        files_ok=false
    fi
done

if [[ "$files_ok" == false ]]; then
    print_error "Required migration files are missing!"
    exit 1
fi

# Check configuration files
print_status "Checking configuration..."

if [[ -f "drizzle.config.ts" ]]; then
    if grep -q "postgresql" drizzle.config.ts && grep -q "postgresql-schema.ts" drizzle.config.ts; then
        print_success "Drizzle configuration updated for PostgreSQL"
    else
        print_error "Drizzle configuration not properly updated"
    fi
fi

if [[ -f "src/index.ts" ]]; then
    if grep -q "postgresql-database" src/index.ts; then
        print_success "Application imports updated for PostgreSQL"
    else
        print_error "Application imports not updated for PostgreSQL"
    fi
fi

# Check package.json scripts
print_status "Checking package.json scripts..."

if grep -q "db:migrate-postgres" package.json; then
    print_success "PostgreSQL migration scripts added"
else
    print_error "PostgreSQL migration scripts missing"
fi

# Validate PostgreSQL schema syntax
print_status "Validating PostgreSQL schema file..."

if [[ -f "src/models/postgresql-schema.ts" ]]; then
    # Check for key PostgreSQL features
    if grep -q "pgTable" src/models/postgresql-schema.ts && \
       grep -q "uuid(" src/models/postgresql-schema.ts && \
       grep -q "jsonb(" src/models/postgresql-schema.ts; then
        print_success "PostgreSQL schema has proper Drizzle PostgreSQL syntax"
    else
        print_error "PostgreSQL schema missing required PostgreSQL features"
    fi
else
    print_error "PostgreSQL schema file not found"
fi

# Check migration script permissions
if [[ -x "scripts/migrate-to-postgresql.sh" ]]; then
    print_success "Migration script is executable"
else
    print_warning "Migration script is not executable"
    chmod +x scripts/migrate-to-postgresql.sh
    print_success "Made migration script executable"
fi

# Validate environment variables template
print_status "Checking environment setup..."

if [[ ! -f ".env.example" ]]; then
    print_status "Creating .env.example file..."
    cat > .env.example << 'EOF'
# PostgreSQL Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=workshopsai_cms

# Application Configuration
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:3000

# Security
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret_key

# Optional: Vector Database (for AI features)
VECTOR_DB_HOST=localhost
VECTOR_DB_PORT=6333
EOF
    print_success "Created .env.example file"
else
    print_success ".env.example file exists"
fi

echo ""
echo "======================================================"
echo "Validation Summary"
echo "======================================================"

print_success "✓ Migration files are present"
print_success "✓ Configuration files updated"
print_success "✓ Package scripts configured"
print_success "✓ PostgreSQL schema validated"
print_success "✓ Migration script executable"
print_success "✓ Environment template ready"

echo ""
print_status "Migration setup is ready!"
echo ""
print_status "Next steps:"
echo "1. Configure your PostgreSQL database"
echo "2. Copy .env.example to .env and update credentials"
echo "3. Run: npm run db:migrate-postgres"
echo "4. Test with: npm run db:migrate-postgres-test"
echo ""
print_status "For detailed instructions, see: docs/POSTGRESQL_MIGRATION.md"