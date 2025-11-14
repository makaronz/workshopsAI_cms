#!/bin/bash

# Comprehensive deployment script for workshopsAI CMS
# Supports staging and production deployments with zero-downtime

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
CONFIG_FILE="${PROJECT_ROOT}/.env.deploy"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS:${NC} $1"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Load configuration
load_config() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        error "Configuration file not found: $CONFIG_FILE"
        error "Please create .env.deploy with required variables"
        exit 1
    fi

    source "$CONFIG_FILE"

    # Validate required variables
    local required_vars=("ENVIRONMENT" "AWS_REGION" "ECR_REPOSITORY" "CLUSTER_NAME")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error "Required variable not set: $var"
            exit 1
        fi
    done
}

# Pre-deployment checks
pre_deployment_checks() {
    log "Running pre-deployment checks..."

    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        error "AWS credentials not configured or invalid"
        exit 1
    fi

    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        error "Docker daemon is not running"
        exit 1
    fi

    # Check if repository exists
    if ! aws ecr describe-repositories --repository-names "$ECR_REPOSITORY" --region "$AWS_REGION" >/dev/null 2>&1; then
        log "ECR repository not found, creating..."
        aws ecr create-repository --repository-name "$ECR_REPOSITORY" --region "$AWS_REGION"
    fi

    # Check cluster exists
    if ! aws ecs describe-clusters --clusters "$CLUSTER_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
        error "ECS cluster not found: $CLUSTER_NAME"
        exit 1
    fi

    # Run tests
    log "Running test suite..."
    cd "$PROJECT_ROOT"
    npm ci
    npm run test

    # Run type checking
    log "Running type checking..."
    npm run typecheck

    # Run security audit
    log "Running security audit..."
    npm audit --audit-level=high

    success "Pre-deployment checks completed"
}

# Build Docker image
build_image() {
    log "Building Docker image..."

    cd "$PROJECT_ROOT"

    # Generate version tag
    local VERSION_TAG="${ENVIRONMENT}-$(git rev-parse --short HEAD)"
    if [[ "$ENVIRONMENT" == "production" ]]; then
        VERSION_TAG="latest"
    fi

    # Login to ECR
    log "Logging into ECR..."
    aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

    # Build and push image
    log "Building and pushing Docker image..."
    docker build \
        --target production \
        --tag "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${VERSION_TAG}" \
        --tag "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S)" \
        .

    docker push "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${VERSION_TAG}"
    docker push "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S)"

    export IMAGE_TAG="$VERSION_TAG"
    success "Docker image built and pushed: $IMAGE_TAG"
}

# Database migration
database_migration() {
    log "Running database migration..."

    # Get current task definition
    local SERVICE_NAME="workshopsai-cms-${ENVIRONMENT}"
    local TASK_DEF=$(aws ecs describe-task-definition --task-definition "$SERVICE_NAME" --region "$AWS_REGION")

    # Extract database connection info from environment variables
    local DB_HOST=$(echo "$TASK_DEF" | jq -r '.taskDefinition.containerDefinitions[0].environment[] | select(.name=="DB_HOST") | .value')
    local DB_NAME=$(echo "$TASK_DEF" | jq -r '.taskDefinition.containerDefinitions[0].environment[] | select(.name=="DB_NAME") | .value')
    local DB_USER=$(echo "$TASK_DEF" | jq -r '.taskDefinition.containerDefinitions[0].environment[] | select(.name=="DB_USER") | .value')

    # Run migration in temporary container
    log "Starting migration container..."
    docker run --rm \
        -e DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}" \
        -e NODE_ENV=production \
        "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}" \
        npm run db:migrate

    success "Database migration completed"
}

# Deploy application
deploy_application() {
    log "Deploying application to $ENVIRONMENT..."

    local SERVICE_NAME="workshopsai-cms-${ENVIRONMENT}"
    local TASK_FAMILY="${SERVICE_NAME}"

    # Register new task definition
    log "Registering new task definition..."
    local NEW_TASK_DEF=$(aws ecs register-task-definition \
        --cli-input-json file://"$PROJECT_ROOT/infrastructure/aws/task-definition-${ENVIRONMENT}.json" \
        --region "$AWS_REGION" \
        --image "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}:${IMAGE_TAG}")

    local NEW_REVISION=$(echo "$NEW_TASK_DEF" | jq -r '.taskDefinition.revision')

    # Update service
    log "Updating ECS service..."
    aws ecs update-service \
        --cluster "$CLUSTER_NAME" \
        --service "$SERVICE_NAME" \
        --task-definition "${TASK_FAMILY}:${NEW_REVISION}" \
        --force-new-deployment \
        --region "$AWS_REGION"

    # Wait for deployment to stabilize
    log "Waiting for deployment to stabilize..."
    aws ecs wait services-stable \
        --cluster "$CLUSTER_NAME" \
        --services "$SERVICE_NAME" \
        --region "$AWS_REGION"

    success "Application deployed successfully"
}

# Health check
health_check() {
    log "Running health checks..."

    local APP_URL
    if [[ "$ENVIRONMENT" == "staging" ]]; then
        APP_URL="https://staging.workshopsai.com"
    else
        APP_URL="https://workshopsai.com"
    fi

    # Wait for application to be ready
    local max_attempts=30
    local attempt=1

    while [[ $attempt -le $max_attempts ]]; do
        log "Health check attempt $attempt/$max_attempts..."

        if curl -f -s "${APP_URL}/health" >/dev/null; then
            success "Application is healthy"
            break
        fi

        if [[ $attempt -eq $max_attempts ]]; then
            error "Health check failed after $max_attempts attempts"
            exit 1
        fi

        sleep 10
        ((attempt++))
    done

    # Run comprehensive health checks
    log "Running comprehensive health checks..."

    # API health
    if ! curl -f -s "${APP_URL}/api/health" >/dev/null; then
        error "API health check failed"
        exit 1
    fi

    # Database connectivity
    if ! curl -f -s "${APP_URL}/api/health/db" >/dev/null; then
        error "Database health check failed"
        exit 1
    fi

    success "All health checks passed"
}

# Rollback function
rollback() {
    warning "Initiating rollback..."

    local SERVICE_NAME="workshopsai-cms-${ENVIRONMENT}"

    # Get previous task definition
    local PREVIOUS_TASK_DEF=$(aws ecs describe-task-definition --task-definition "$SERVICE_NAME" --region "$AWS_REGION")
    local PREVIOUS_REVISION=$(echo "$PREVIOUS_TASK_DEF" | jq -r '.taskDefinition.revision')

    if [[ "$PREVIOUS_REVISION" == "1" ]]; then
        error "No previous revision to rollback to"
        exit 1
    fi

    local ROLLBACK_REVISION=$((PREVIOUS_REVISION - 1))

    # Update service with previous task definition
    aws ecs update-service \
        --cluster "$CLUSTER_NAME" \
        --service "$SERVICE_NAME" \
        --task-definition "${SERVICE_NAME}:${ROLLBACK_REVISION}" \
        --force-new-deployment \
        --region "$AWS_REGION"

    # Wait for rollback to complete
    aws ecs wait services-stable \
        --cluster "$CLUSTER_NAME" \
        --services "$SERVICE_NAME" \
        --region "$AWS_REGION"

    success "Rollback completed to revision $ROLLBACK_REVISION"
}

# Cleanup function
cleanup() {
    log "Cleaning up..."

    # Clean up old Docker images
    docker system prune -f

    # Clean up old ECR images (keep last 10)
    log "Cleaning up old ECR images..."
    local IMAGES_TO_DELETE=$(aws ecr describe-images \
        --repository-name "$ECR_REPOSITORY" \
        --region "$AWS_REGION" \
        --query "sort_by(imageDetails, &imagePushedDateTime)[:-10]" \
        --output text)

    if [[ -n "$IMAGES_TO_DELETE" ]]; then
        aws ecr batch-delete-image \
            --repository-name "$ECR_REPOSITORY" \
            --region "$AWS_REGION" \
            --image-ids "$IMAGES_TO_DELETE"
    fi

    success "Cleanup completed"
}

# Post-deployment notifications
notify() {
    log "Sending deployment notifications..."

    local STATUS="success"
    local EMOJI="✅"
    local COLOR="good"

    # Determine status based on exit code
    if [[ $? -ne 0 ]]; then
        STATUS="failure"
        EMOJI="❌"
        COLOR="danger"
    fi

    # Send Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local SLACK_MESSAGE="$EMOJI Deployment to $ENVIRONMENT $STATUS"
        local SLACK_PAYLOAD=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$COLOR",
            "title": "workshopsAI CMS Deployment",
            "text": "$SLACK_MESSAGE",
            "fields": [
                {
                    "title": "Environment",
                    "value": "$ENVIRONMENT",
                    "short": true
                },
                {
                    "title": "Version",
                    "value": "$IMAGE_TAG",
                    "short": true
                },
                {
                    "title": "Deployed by",
                    "value": "$(whoami)",
                    "short": true
                },
                {
                    "title": "Time",
                    "value": "$(date)",
                    "short": true
                }
            ]
        }
    ]
}
EOF
        )

        curl -X POST -H 'Content-type: application/json' \
            --data "$SLACK_PAYLOAD" \
            "$SLACK_WEBHOOK_URL"
    fi

    # Send email notification for production deployments
    if [[ "$ENVIRONMENT" == "production" && -n "${NOTIFICATION_EMAIL:-}" ]]; then
        local EMAIL_SUBJECT="Deployment to $ENVIRONMENT $STATUS - workshopsAI CMS"
        local EMAIL_BODY="Deployment to $ENVIRONMENT $STATUS\n\nVersion: $IMAGE_TAG\nDeployed by: $(whoami)\nTime: $(date)"

        echo "$EMAIL_BODY" | mail -s "$EMAIL_SUBJECT" "$NOTIFICATION_EMAIL"
    fi

    success "Notifications sent"
}

# Main execution
main() {
    local COMMAND=${1:-deploy}

    case $COMMAND in
        "deploy")
            log "Starting deployment to $ENVIRONMENT..."
            load_config
            pre_deployment_checks
            build_image
            database_migration
            deploy_application
            health_check
            cleanup
            notify
            success "Deployment completed successfully!"
            ;;
        "rollback")
            load_config
            rollback
            success "Rollback completed successfully!"
            ;;
        "health-check")
            load_config
            health_check
            ;;
        "cleanup")
            load_config
            cleanup
            ;;
        *)
            echo "Usage: $0 {deploy|rollback|health-check|cleanup}"
            exit 1
            ;;
    esac
}

# Handle signals gracefully
trap 'error "Script interrupted"; exit 1' INT TERM

# Run main function
main "$@"