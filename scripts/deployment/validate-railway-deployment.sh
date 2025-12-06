#!/bin/bash

# Railway Deployment Validation Script
# Comprehensive validation script for Railway deployment readiness

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VALIDATION_LOG="$PROJECT_ROOT/logs/railway-validation.log"

# Railway deployment thresholds
MAX_MEMORY_MB=512
MAX_CPU_PERCENT=80
MAX_BUILD_TIME_MINUTES=10
MAX_HEALTH_CHECK_SECONDS=30

# Create logs directory
mkdir -p "$PROJECT_ROOT/logs"

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    case $level in
        "ERROR") echo -e "${RED}[ERROR]${NC} $message" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        "INFO")  echo -e "${BLUE}[INFO]${NC} $message" ;;
        "SUCCESS") echo -e "${GREEN}[SUCCESS]${NC} $message" ;;
    esac

    echo "[$timestamp] [$level] $message" >> "$VALIDATION_LOG"
}

# Validation functions
validate_environment_variables() {
    log "INFO" "Validating environment variables..."

    local required_vars=(
        "NODE_ENV"
        "PORT"
        "DB_HOST"
        "DB_PORT"
        "DB_NAME"
        "DB_USER"
        "DB_PASSWORD"
        "JWT_SECRET"
        "REDIS_URL"
    )

    local missing_vars=()
    local invalid_vars=()

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        else
            case $var in
                "PORT"|"DB_PORT")
                    if ! [[ "${!var}" =~ ^[0-9]+$ ]] || [[ "${!var}" -lt 1 ]] || [[ "${!var}" -gt 65536 ]]; then
                        invalid_vars+=("$var (invalid port number)")
                    fi
                    ;;
                "NODE_ENV")
                    if [[ ! "${!var}" =~ ^(development|production|test)$ ]]; then
                        invalid_vars+=("$var (must be development|production|test)")
                    fi
                    ;;
                "JWT_SECRET")
                    if [[ ${#var} -lt 32 ]]; then
                        invalid_vars+=("$var (must be at least 32 characters)")
                    fi
                    ;;
            esac
        fi
    done

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log "ERROR" "Missing required environment variables: ${missing_vars[*]}"
        return 1
    fi

    if [[ ${#invalid_vars[@]} -gt 0 ]]; then
        log "ERROR" "Invalid environment variables: ${invalid_vars[*]}"
        return 1
    fi

    log "SUCCESS" "All required environment variables are valid"
    return 0
}

validate_package_json() {
    log "INFO" "Validating package.json for Railway deployment..."

    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        log "ERROR" "package.json not found"
        return 1
    fi

    # Check for start script
    if ! jq -e '.scripts.start' "$PROJECT_ROOT/package.json" > /dev/null 2>&1; then
        log "ERROR" "Start script not found in package.json"
        return 1
    fi

    # Check Node.js version
    local node_version=$(jq -r '.engines.node // "not specified"' "$PROJECT_ROOT/package.json")
    if [[ "$node_version" == "not specified" ]]; then
        log "WARN" "Node.js version not specified in engines"
    else
        if [[ ! "$node_version" =~ ^1[68]|[2][0-9] ]]; then
            log "WARN" "Node.js version $node_version - consider using Node.js 18 or 20 for best Railway support"
        fi
    fi

    # Check for Railway-specific configurations
    local has_railway_config=false
    if [[ -f "$PROJECT_ROOT/railway.toml" ]] || [[ -f "$PROJECT_ROOT/railway.json" ]]; then
        has_railway_config=true
    fi

    if [[ "$has_railway_config" == false ]]; then
        log "WARN" "No Railway configuration file found (railway.toml or railway.json)"
    fi

    log "SUCCESS" "package.json validation completed"
    return 0
}

validate_docker_configuration() {
    log "INFO" "Validating Docker configuration..."

    if [[ ! -f "$PROJECT_ROOT/Dockerfile" ]]; then
        log "ERROR" "Dockerfile not found"
        return 1
    fi

    # Check for common Docker issues
    local docker_issues=()

    # Check if Dockerfile uses proper base image
    if ! grep -q "FROM.*node" "$PROJECT_ROOT/Dockerfile"; then
        docker_issues+=("Dockerfile should use Node.js base image")
    fi

    # Check for EXPOSE instruction
    if ! grep -q "EXPOSE" "$PROJECT_ROOT/Dockerfile"; then
        docker_issues+=("Dockerfile should include EXPOSE instruction")
    fi

    # Check for health check
    if ! grep -q "HEALTHCHECK" "$PROJECT_ROOT/Dockerfile"; then
        docker_issues+=("Consider adding HEALTHCHECK to Dockerfile")
    fi

    # Check for non-root user
    if ! grep -q -E "(USER|adduser|addgroup)" "$PROJECT_ROOT/Dockerfile"; then
        docker_issues+=("Dockerfile should use non-root user for security")
    fi

    if [[ ${#docker_issues[@]} -gt 0 ]]; then
        for issue in "${docker_issues[@]}"; do
            log "WARN" "$issue"
        done
    else
        log "SUCCESS" "Dockerfile validation passed"
    fi

    return 0
}

test_docker_build() {
    log "INFO" "Testing Docker build process..."

    local build_start=$(date +%s)

    if ! docker build -t workshopsai-cms:test "$PROJECT_ROOT" > /dev/null 2>&1; then
        log "ERROR" "Docker build failed"
        return 1
    fi

    local build_end=$(date +%s)
    local build_duration=$((build_end - build_start))

    if [[ $build_duration -gt $((MAX_BUILD_TIME_MINUTES * 60)) ]]; then
        log "WARN" "Docker build took ${build_duration}s (threshold: ${MAX_BUILD_TIME_MINUTES}m)"
    fi

    log "SUCCESS" "Docker build completed successfully (${build_duration}s)"
    return 0
}

test_database_connection() {
    log "INFO" "Testing database connection..."

    local db_host="${DB_HOST:-localhost}"
    local db_port="${DB_PORT:-5432}"
    local db_name="${DB_NAME:-test_workshops_cms}"
    local db_user="${DB_USER:-postgres}"

    # Test basic connectivity
    if ! PGPASSWORD="${DB_PASSWORD}" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -c "SELECT 1;" > /dev/null 2>&1; then
        log "ERROR" "Database connection failed"
        return 1
    fi

    # Test table existence
    local required_tables=(
        "users"
        "workshops"
        "facilitators"
        "locations"
        "tags"
    )

    for table in "${required_tables[@]}"; do
        if ! PGPASSWORD="${DB_PASSWORD}" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -c "SELECT 1 FROM $table LIMIT 1;" > /dev/null 2>&1; then
            log "ERROR" "Required table '$table' not found or inaccessible"
            return 1
        fi
    done

    log "SUCCESS" "Database connection and schema validation passed"
    return 0
}

test_redis_connection() {
    log "INFO" "Testing Redis connection..."

    if ! command -v redis-cli > /dev/null 2>&1; then
        log "WARN" "redis-cli not found, skipping Redis connection test"
        return 0
    fi

    local redis_url="${REDIS_URL:-redis://localhost:6379}"

    # Extract Redis connection details from URL
    local redis_host=$(echo "$redis_url" | sed -n 's|redis://\([^:]*\):.*|\1|p')
    local redis_port=$(echo "$redis_url" | sed -n 's|redis://[^:]*:\([0-9]*\).*|\1|p')

    redis_host="${redis_host:-localhost}"
    redis_port="${redis_port:-6379}"

    # Test Redis connectivity
    if ! redis-cli -h "$redis_host" -p "$redis_port" ping > /dev/null 2>&1; then
        log "ERROR" "Redis connection failed"
        return 1
    fi

    log "SUCCESS" "Redis connection test passed"
    return 0
}

test_health_endpoint() {
    log "INFO" "Testing application health endpoint..."

    # Check if application is running
    local app_port="${PORT:-3010}"
    local health_url="http://localhost:$app_port/health"

    local health_start=$(date +%s)

    # Wait for application to be ready
    local timeout=$MAX_HEALTH_CHECK_SECONDS
    while [[ $timeout -gt 0 ]]; do
        if curl -sf "$health_url" > /dev/null 2>&1; then
            break
        fi
        sleep 1
        timeout=$((timeout - 1))
    done

    if [[ $timeout -eq 0 ]]; then
        log "ERROR" "Health endpoint not responding after ${MAX_HEALTH_CHECK_SECONDS}s"
        return 1
    fi

    local health_end=$(date +%s)
    local health_response_time=$((health_end - health_start))

    # Validate health response
    local health_response=$(curl -s "$health_url")

    if ! echo "$health_response" | jq -e '.status' > /dev/null 2>&1; then
        log "ERROR" "Health endpoint returned invalid JSON response"
        return 1
    fi

    local health_status=$(echo "$health_response" | jq -r '.status')
    if [[ "$health_status" != "healthy" ]]; then
        log "ERROR" "Health endpoint status: $health_status"
        return 1
    fi

    log "SUCCESS" "Health endpoint test passed (response time: ${health_response_time}s)"
    return 0
}

run_security_validation() {
    log "INFO" "Running security validation..."

    # Check for security issues in npm packages
    if ! npm audit --audit-level=moderate > /dev/null 2>&1; then
        log "WARN" "Security vulnerabilities found in npm packages"
        npm audit --audit-level=moderate || true
    fi

    # Check for sensitive data in environment
    local sensitive_patterns=(
        "password"
        "secret"
        "key"
        "token"
    )

    local security_issues=()

    # Check .env files for sensitive data
    for env_file in .env*; do
        if [[ -f "$env_file" ]]; then
            while IFS= read -r line; do
                for pattern in "${sensitive_patterns[@]}"; do
                    if [[ "$line" =~ ^[A-Z_]*$pattern.*=.*(default|example|test|dummy) ]]; then
                        security_issues+=("Potential insecure default value in $env_file: $pattern")
                    fi
                done
            done < "$env_file"
        fi
    done

    if [[ ${#security_issues[@]} -gt 0 ]]; then
        for issue in "${security_issues[@]}"; do
            log "WARN" "$issue"
        done
    fi

    log "SUCCESS" "Security validation completed"
    return 0
}

check_deployment_readiness() {
    log "INFO" "Checking deployment readiness..."

    local readiness_score=0
    local max_score=10

    # Environment variables (2 points)
    if validate_environment_variables; then
        readiness_score=$((readiness_score + 2))
    fi

    # Package.json (1 point)
    if validate_package_json; then
        readiness_score=$((readiness_score + 1))
    fi

    # Docker configuration (1 point)
    if validate_docker_configuration; then
        readiness_score=$((readiness_score + 1))
    fi

    # Docker build (2 points)
    if test_docker_build; then
        readiness_score=$((readiness_score + 2))
    fi

    # Database connection (2 points)
    if test_database_connection; then
        readiness_score=$((readiness_score + 2))
    fi

    # Redis connection (1 point)
    if test_redis_connection; then
        readiness_score=$((readiness_score + 1))
    fi

    # Health endpoint (1 point)
    if test_health_endpoint; then
        readiness_score=$((readiness_score + 1))
    fi

    local readiness_percent=$((readiness_score * 100 / max_score))

    if [[ $readiness_percent -ge 90 ]]; then
        log "SUCCESS" "Deployment readiness: ${readiness_percent}% (EXCELLENT)"
    elif [[ $readiness_percent -ge 80 ]]; then
        log "INFO" "Deployment readiness: ${readiness_percent}% (GOOD)"
    elif [[ $readiness_percent -ge 70 ]]; then
        log "WARN" "Deployment readiness: ${readiness_percent}% (ACCEPTABLE)"
    else
        log "ERROR" "Deployment readiness: ${readiness_percent}% (NOT READY)"
        return 1
    fi

    return 0
}

generate_deployment_report() {
    log "INFO" "Generating deployment validation report..."

    local report_file="$PROJECT_ROOT/logs/railway-deployment-report.json"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")

    # Collect system information
    local node_version=$(node --version)
    local npm_version=$(npm --version)
    local docker_version=$(docker --version 2>/dev/null || echo "not installed")
    local git_branch=$(git branch --show-current 2>/dev/null || echo "unknown")
    local git_commit=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

    # Generate JSON report
    cat > "$report_file" << EOF
{
  "timestamp": "$timestamp",
  "project": "workshopsAI CMS",
  "validation": {
    "environment_variables": {
      "status": "$(validate_environment_variables >/dev/null 2>&1 && echo "PASS" || echo "FAIL")"
    },
    "package_json": {
      "status": "$(validate_package_json >/dev/null 2>&1 && echo "PASS" || echo "FAIL")"
    },
    "docker_configuration": {
      "status": "$(validate_docker_configuration >/dev/null 2>&1 && echo "PASS" || echo "FAIL")"
    },
    "docker_build": {
      "status": "$(test_docker_build >/dev/null 2>&1 && echo "PASS" || echo "FAIL")"
    },
    "database_connection": {
      "status": "$(test_database_connection >/dev/null 2>&1 && echo "PASS" || echo "FAIL")"
    },
    "redis_connection": {
      "status": "$(test_redis_connection >/dev/null 2>&1 && echo "PASS" || echo "FAIL")"
    },
    "health_endpoint": {
      "status": "$(test_health_endpoint >/dev/null 2>&1 && echo "PASS" || echo "FAIL")"
    }
  },
  "system": {
    "node_version": "$node_version",
    "npm_version": "$npm_version",
    "docker_version": "$docker_version",
    "git_branch": "$git_branch",
    "git_commit": "$git_commit"
  },
  "environment": {
    "node_env": "${NODE_ENV:-not_set}",
    "port": "${PORT:-not_set}",
    "database_host": "${DB_HOST:-not_set}",
    "redis_url_set": $([[ -n "${REDIS_URL:-}" ]] && echo "true" || echo "false")
  }
}
EOF

    log "SUCCESS" "Deployment report generated: $report_file"
}

# Main execution
main() {
    log "INFO" "Starting Railway deployment validation..."

    # Change to project root
    cd "$PROJECT_ROOT"

    # Load environment variables
    if [[ -f ".env" ]]; then
        set -a
        source .env
        set +a
    fi

    # Run validations
    local validation_passed=true

    # Security validation (always run)
    run_security_validation || validation_passed=false

    # Deployment readiness check
    check_deployment_readiness || validation_passed=false

    # Generate report
    generate_deployment_report

    if [[ "$validation_passed" == true ]]; then
        log "SUCCESS" "Railway deployment validation completed successfully"
        echo ""
        echo "🚀 Your application is ready for Railway deployment!"
        echo ""
        echo "Next steps:"
        echo "1. Push your code to your Git repository"
        echo "2. Connect your repository to Railway"
        echo "3. Configure environment variables in Railway dashboard"
        echo "4. Deploy!"
        echo ""
        exit 0
    else
        log "ERROR" "Railway deployment validation failed"
        echo ""
        echo "❌ Your application is not ready for Railway deployment"
        echo ""
        echo "Please address the issues above before deploying."
        echo "Check the validation log for details: $VALIDATION_LOG"
        echo ""
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Railway Deployment Validation Script"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --env-only     Only validate environment variables"
        echo "  --build-only   Only test Docker build"
        echo "  --health-only  Only test health endpoint"
        echo ""
        exit 0
        ;;
    --env-only)
        validate_environment_variables
        exit $?
        ;;
    --build-only)
        test_docker_build
        exit $?
        ;;
    --health-only)
        test_health_endpoint
        exit $?
        ;;
esac

# Run main function
main "$@"