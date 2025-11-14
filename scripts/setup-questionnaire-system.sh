#!/bin/bash

# Setup Script for Questionnaire System
# This script sets up the complete questionnaire system for workshopsAI CMS

set -e

echo "🚀 Setting up workshopsAI CMS Questionnaire System..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if required environment variables are set
check_env_vars() {
    echo "🔍 Checking environment variables..."

    if [ -z "$DB_HOST" ]; then
        print_warning "DB_HOST not set, using default: localhost"
        export DB_HOST=localhost
    fi

    if [ -z "$DB_PORT" ]; then
        print_warning "DB_PORT not set, using default: 3306"
        export DB_PORT=3306
    fi

    if [ -z "$DB_USER" ]; then
        print_warning "DB_USER not set, using default: root"
        export DB_USER=root
    fi

    if [ -z "$DB_NAME" ]; then
        print_warning "DB_NAME not set, using default: workshopsai_cms"
        export DB_NAME=workshopsai_cms
    fi

    if [ -z "$DB_PASSWORD" ]; then
        print_error "DB_PASSWORD environment variable is required"
        exit 1
    fi

    print_status "Environment variables configured"
}

# Install dependencies
install_dependencies() {
    echo "📦 Installing dependencies..."

    if command -v npm &> /dev/null; then
        npm install
        print_status "Dependencies installed"
    else
        print_error "npm is not installed"
        exit 1
    fi
}

# Run database migration
run_migration() {
    echo "🗄️  Running database migration..."

    # Check if MySQL connection works
    if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" -e "USE $DB_NAME;" 2>/dev/null; then
        # Run the questionnaire migration
        mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < migrations/001_add_questionnaire_system.sql
        print_status "Database migration completed"
    else
        print_error "Cannot connect to database. Please check your connection parameters."
        exit 1
    fi
}

# Generate Drizzle schema
generate_schema() {
    echo "🔧 Generating Drizzle schema..."

    npm run db:generate
    print_status "Drizzle schema generated"
}

# Create sample user (if doesn't exist)
create_sample_user() {
    echo "👤 Creating sample sociologist user..."

    # Check if user already exists
    USER_EXISTS=$(mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "SELECT COUNT(*) FROM users WHERE email='sociologist@workshopsai.com';" | tail -1)

    if [ "$USER_EXISTS" -eq 0 ]; then
        # Hash password (simple example - in production use proper hashing)
        PASSWORD_HASH=$(echo -n "password123" | sha256sum | cut -d' ' -f1)

        mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -e "
            INSERT INTO users (openId, name, email, password, role, isActive, emailVerified, createdAt, updatedAt)
            VALUES ('sociologist-123', 'Sociologist Editor', 'sociologist@workshopsai.com', '$PASSWORD_HASH', 'sociologist-editor', true, true, NOW(), NOW());
        "
        print_status "Sample sociologist user created"
    else
        print_status "Sample sociologist user already exists"
    fi
}

# Start the development server
start_dev_server() {
    echo "🚀 Starting development server..."

    echo "📚 API Documentation: http://localhost:3001/api/docs"
    echo "🏥 Health Check: http://localhost:3001/health"
    echo "🔗 Questionnaire Demo: Open examples/questionnaire-demo.html in your browser"
    echo ""
    echo "👤 Sample Login:"
    echo "   Email: sociologist@workshopsai.com"
    echo "   Password: password123"
    echo ""
    echo "🔑 JWT Secret: Make sure JWT_SECRET is set in your .env file"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""

    npm run dev
}

# Main setup flow
main() {
    echo "🎯 workshopsAI CMS Questionnaire System Setup"
    echo "==============================================="
    echo ""

    check_env_vars
    install_dependencies
    run_migration
    generate_schema
    create_sample_user

    echo ""
    print_status "Setup completed successfully!"
    echo ""

    start_dev_server
}

# Handle script arguments
case "${1:-setup}" in
    "setup")
        main
        ;;
    "migrate")
        check_env_vars
        run_migration
        ;;
    "schema")
        npm run db:generate
        ;;
    "dev")
        check_env_vars
        start_dev_server
        ;;
    *)
        echo "Usage: $0 [setup|migrate|schema|dev]"
        echo "  setup  - Run complete setup (default)"
        echo "  migrate - Run database migration only"
        echo "  schema  - Generate Drizzle schema only"
        echo "  dev    - Start development server only"
        exit 1
        ;;
esac