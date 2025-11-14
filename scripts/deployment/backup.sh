#!/bin/bash

# Comprehensive backup script for workshopsAI CMS
# Supports database, file storage, and configuration backups

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

# Logging functions
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
        exit 1
    fi

    source "$CONFIG_FILE"

    # Validate required variables
    local required_vars=("AWS_REGION" "BACKUP_S3_BUCKET")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error "Required variable not set: $var"
            exit 1
        fi
    done

    # Set defaults
    BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
    BACKUP_TYPE="${BACKUP_TYPE:-full}"
    COMPRESS_BACKUP="${COMPRESS_BACKUP:-true}"
    BACKUP_PARALLEL="${BACKUP_PARALLEL:-true}"
}

# Initialize backup environment
init_backup() {
    log "Initializing backup environment..."

    # Create backup directory
    BACKUP_DIR="/tmp/workshopsai-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"

    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        error "AWS credentials not configured or invalid"
        exit 1
    fi

    # Check S3 bucket access
    if ! aws s3 ls "s3://$BACKUP_S3_BUCKET" >/dev/null 2>&1; then
        error "Cannot access S3 bucket: $BACKUP_S3_BUCKET"
        exit 1
    fi

    success "Backup environment initialized"
}

# Database backup
backup_database() {
    log "Starting database backup..."

    local DB_BACKUP_FILE="$BACKUP_DIR/database-$(date +%Y%m%d-%H%M%S).sql"

    # Get database connection details from ECS task definition
    local SERVICE_NAME="workshopsai-cms-${ENVIRONMENT:-production}"
    local TASK_DEF=$(aws ecs describe-task-definition --task-definition "$SERVICE_NAME" --region "$AWS_REGION")

    local DB_HOST=$(echo "$TASK_DEF" | jq -r '.taskDefinition.containerDefinitions[0].environment[] | select(.name=="DB_HOST") | .value')
    local DB_NAME=$(echo "$TASK_DEF" | jq -r '.taskDefinition.containerDefinitions[0].environment[] | select(.name=="DB_NAME") | .value')
    local DB_USER=$(echo "$TASK_DEF" | jq -r '.taskDefinition.containerDefinitions[0].environment[] | select(.name=="DB_USER") | .value')
    local DB_PORT=$(echo "$TASK_DEF" | jq -r '.taskDefinition.containerDefinitions[0].environment[] | select(.name=="DB_PORT") | .value')

    # Validate database connection details
    if [[ -z "$DB_HOST" || -z "$DB_NAME" || -z "$DB_USER" ]]; then
        error "Could not retrieve database connection details"
        exit 1
    fi

    log "Connecting to database: $DB_HOST:$DB_PORT/$DB_NAME"

    # Perform database backup
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        --host="$DB_HOST" \
        --port="$DB_PORT" \
        --username="$DB_USER" \
        --dbname="$DB_NAME" \
        --verbose \
        --no-password \
        --format=custom \
        --compress=9 \
        --file="$DB_BACKUP_FILE"

    if [[ $? -ne 0 ]]; then
        error "Database backup failed"
        exit 1
    fi

    # Get backup file size
    local BACKUP_SIZE=$(du -h "$DB_BACKUP_FILE" | cut -f1)
    log "Database backup completed. Size: $BACKUP_SIZE"

    # Compress backup if requested
    if [[ "$COMPRESS_BACKUP" == "true" ]]; then
        log "Compressing database backup..."
        gzip "$DB_BACKUP_FILE"
        DB_BACKUP_FILE="${DB_BACKUP_FILE}.gz"
        BACKUP_SIZE=$(du -h "$DB_BACKUP_FILE" | cut -f1)
        log "Compressed backup size: $BACKUP_SIZE"
    fi

    # Upload to S3
    local S3_KEY="database/$(basename "$DB_BACKUP_FILE")"
    log "Uploading database backup to S3: s3://$BACKUP_S3_BUCKET/$S3_KEY"

    aws s3 cp "$DB_BACKUP_FILE" "s3://$BACKUP_S3_BUCKET/$S3_KEY" \
        --storage-class STANDARD_IA \
        --metadata "environment=${ENVIRONMENT:-production},backup-type=database,created-by=$(whoami)"

    # Verify upload
    if ! aws s3 ls "s3://$BACKUP_S3_BUCKET/$S3_KEY" >/dev/null; then
        error "Failed to verify database backup upload"
        exit 1
    fi

    success "Database backup completed and uploaded to S3"
}

# File storage backup
backup_files() {
    log "Starting file storage backup..."

    local FILES_BACKUP_DIR="$BACKUP_DIR/files"
    mkdir -p "$FILES_BACKUP_DIR"

    # Get file storage configuration
    local SERVICE_NAME="workshopsai-cms-${ENVIRONMENT:-production}"
    local TASK_DEF=$(aws ecs describe-task-definition --task-definition "$SERVICE_NAME" --region "$AWS_REGION")

    local STORAGE_PROVIDER=$(echo "$TASK_DEF" | jq -r '.taskDefinition.containerDefinitions[0].environment[] | select(.name=="STORAGE_DEFAULT_PROVIDER") | .value')

    case "$STORAGE_PROVIDER" in
        "aws-s3")
            backup_s3_files
            ;;
        "local")
            backup_local_files
            ;;
        "google-cloud")
            backup_gcs_files
            ;;
        *)
            warning "Unknown storage provider: $STORAGE_PROVIDER. Skipping file backup."
            return
            ;;
    esac

    success "File storage backup completed"
}

# Backup S3 files
backup_s3_files() {
    log "Backing up S3 file storage..."

    local TASK_DEF=$(aws ecs describe-task-definition --task-definition "workshopsai-cms-${ENVIRONMENT:-production}" --region "$AWS_REGION")
    local S3_BUCKET=$(echo "$TASK_DEF" | jq -r '.taskDefinition.containerDefinitions[0].environment[] | select(.name=="AWS_S3_BUCKET") | .value')

    if [[ -z "$S3_BUCKET" || "$S3_BUCKET" == "null" ]]; then
        warning "S3 bucket not configured. Skipping S3 file backup."
        return
    fi

    log "Syncing files from S3 bucket: $S3_BUCKET"

    # Sync S3 files to local backup directory
    aws s3 sync "s3://$S3_BUCKET" "$FILES_BACKUP_DIR" \
        --exclude "tmp/*" \
        --exclude "cache/*" \
        --exclude "*.tmp" \
        --delete

    # Create tar archive
    local FILES_ARCHIVE="$BACKUP_DIR/files-$(date +%Y%m%d-%H%M%S).tar.gz"
    tar -czf "$FILES_ARCHIVE" -C "$FILES_BACKUP_DIR" .

    # Upload to S3 backup bucket
    local S3_KEY="files/$(basename "$FILES_ARCHIVE")"
    log "Uploading files backup to S3: s3://$BACKUP_S3_BUCKET/$S3_KEY"

    aws s3 cp "$FILES_ARCHIVE" "s3://$BACKUP_S3_BUCKET/$S3_KEY" \
        --storage-class STANDARD_IA \
        --metadata "environment=${ENVIRONMENT:-production},backup-type=files,created-by=$(whoami)"

    success "S3 files backup completed"
}

# Backup local files
backup_local_files() {
    log "Backing up local file storage..."

    # For local storage, we'd need to access the container or persistent volume
    # This is a simplified version - adjust based on your actual setup
    warning "Local file backup not implemented. Please implement based on your storage setup."
}

# Backup GCS files
backup_gcs_files() {
    log "Backing up Google Cloud Storage files..."

    # Get GCS configuration
    local TASK_DEF=$(aws ecs describe-task-definition --task-definition "workshopsai-cms-${ENVIRONMENT:-production}" --region "$AWS_REGION")
    local GCS_BUCKET=$(echo "$TASK_DEF" | jq -r '.taskDefinition.containerDefinitions[0].environment[] | select(.name=="GCS_BUCKET_NAME") | .value')

    if [[ -z "$GCS_BUCKET" || "$GCS_BUCKET" == "null" ]]; then
        warning "GCS bucket not configured. Skipping GCS file backup."
        return
    fi

    # Use gsutil to sync files (requires Google Cloud SDK)
    if command -v gsutil >/dev/null; then
        log "Syncing files from GCS bucket: $GCS_BUCKET"
        gsutil -m rsync -r "gs://$GCS_BUCKET" "$FILES_BACKUP_DIR"

        # Create tar archive
        local FILES_ARCHIVE="$BACKUP_DIR/files-gcs-$(date +%Y%m%d-%H%M%S).tar.gz"
        tar -czf "$FILES_ARCHIVE" -C "$FILES_BACKUP_DIR" .

        # Upload to S3 backup bucket
        local S3_KEY="files/$(basename "$FILES_ARCHIVE")"
        log "Uploading GCS files backup to S3: s3://$BACKUP_S3_BUCKET/$S3_KEY"

        aws s3 cp "$FILES_ARCHIVE" "s3://$BACKUP_S3_BUCKET/$S3_KEY" \
            --storage-class STANDARD_IA \
            --metadata "environment=${ENVIRONMENT:-production},backup-type=files-gcs,created-by=$(whoami)"
    else
        warning "Google Cloud SDK not found. Skipping GCS file backup."
    fi

    success "GCS files backup completed"
}

# Configuration backup
backup_configuration() {
    log "Starting configuration backup..."

    local CONFIG_BACKUP_FILE="$BACKUP_DIR/configuration-$(date +%Y%m%d-%H%M%S).tar.gz"

    # Create configuration backup
    local TEMP_CONFIG_DIR="$BACKUP_DIR/config"
    mkdir -p "$TEMP_CONFIG_DIR"

    # Backup application configuration
    cp "$CONFIG_FILE" "$TEMP_CONFIG_DIR/" 2>/dev/null || true
    cp "$PROJECT_ROOT/.env.example" "$TEMP_CONFIG_DIR/" 2>/dev/null || true

    # Backup infrastructure configuration
    if [[ -d "$PROJECT_ROOT/infrastructure" ]]; then
        cp -r "$PROJECT_ROOT/infrastructure" "$TEMP_CONFIG_DIR/"
    fi

    # Backup Docker configurations
    cp "$PROJECT_ROOT/docker-compose"*".yml" "$TEMP_CONFIG_DIR/" 2>/dev/null || true
    cp "$PROJECT_ROOT/Dockerfile" "$TEMP_CONFIG_DIR/" 2>/dev/null || true

    # Backup CI/CD configurations
    if [[ -d "$PROJECT_ROOT/.github" ]]; then
        cp -r "$PROJECT_ROOT/.github" "$TEMP_CONFIG_DIR/"
    fi

    # Create archive
    tar -czf "$CONFIG_BACKUP_FILE" -C "$TEMP_CONFIG_DIR" .

    # Upload to S3
    local S3_KEY="configuration/$(basename "$CONFIG_BACKUP_FILE")"
    log "Uploading configuration backup to S3: s3://$BACKUP_S3_BUCKET/$S3_KEY"

    aws s3 cp "$CONFIG_BACKUP_FILE" "s3://$BACKUP_S3_BUCKET/$S3_KEY" \
        --storage-class STANDARD_IA \
        --metadata "environment=${ENVIRONMENT:-production},backup-type=configuration,created-by=$(whoami)"

    success "Configuration backup completed"
}

# Log backup
backup_logs() {
    log "Starting log backup..."

    local LOGS_BACKUP_FILE="$BACKUP_DIR/logs-$(date +%Y%m%d-%H%M%S).tar.gz"

    # Get log files from CloudWatch (last 7 days)
    local LOG_GROUP_NAME="/ecs/workshopsai-cms-${ENVIRONMENT:-production}"
    local END_TIME=$(date +%s)
    local START_TIME=$((END_TIME - 7 * 24 * 3600))  # 7 days ago

    # Create logs directory
    local LOGS_DIR="$BACKUP_DIR/logs"
    mkdir -p "$LOGS_DIR"

    # Export logs from CloudWatch
    aws logs export-task \
        --task-name "logs-export-$(date +%Y%m%d-%H%M%S)" \
        --log-group-name "$LOG_GROUP_NAME" \
        --from "$START_TIME" \
        --to "$END_TIME" \
        --destination "s3://$BACKUP_S3_BUCKET/logs-temp/" \
        --destination-prefix "logs-$(date +%Y%m%d-%H%M%S)" \
        --region "$AWS_REGION" \
        >/dev/null 2>&1 || warning "Could not export CloudWatch logs"

    # For alternative approach, download logs directly
    aws logs filter-log-events \
        --log-group-name "$LOG_GROUP_NAME" \
        --start-time "$START_TIME"000 \
        --end-time "$END_TIME"000 \
        --region "$AWS_REGION" \
        --query 'events[*].[timestamp,message]' \
        --output text > "$LOGS_DIR/cloudwatch-logs.txt" 2>/dev/null || warning "Could not download CloudWatch logs"

    # Create archive if logs were collected
    if [[ -f "$LOGS_DIR/cloudwatch-logs.txt" && -s "$LOGS_DIR/cloudwatch-logs.txt" ]]; then
        tar -czf "$LOGS_BACKUP_FILE" -C "$LOGS_DIR" .

        # Upload to S3
        local S3_KEY="logs/$(basename "$LOGS_BACKUP_FILE")"
        log "Uploading log backup to S3: s3://$BACKUP_S3_BUCKET/$S3_KEY"

        aws s3 cp "$LOGS_BACKUP_FILE" "s3://$BACKUP_S3_BUCKET/$S3_KEY" \
            --storage-class STANDARD_IA \
            --metadata "environment=${ENVIRONMENT:-production},backup-type=logs,created-by=$(whoami)"

        success "Log backup completed"
    else
        warning "No logs collected for backup"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old backups..."

    local CUTOFF_DATE=$(date -d "$BACKUP_RETENTION_DAYS days ago" +%Y%m%d)

    # Clean up old database backups
    aws s3 ls "s3://$BACKUP_S3_BUCKET/database/" --recursive | \
        while read -r line; do
            local DATE=$(echo "$line" | awk '{print $1}' | tr -d '-')
            local FILE=$(echo "$line" | awk '{print $4}')

            if [[ "$DATE" < "$CUTOFF_DATE" ]]; then
                log "Deleting old backup: $FILE"
                aws s3 rm "s3://$BACKUP_S3_BUCKET/$FILE" || true
            fi
        done

    # Clean up old file backups
    aws s3 ls "s3://$BACKUP_S3_BUCKET/files/" --recursive | \
        while read -r line; do
            local DATE=$(echo "$line" | awk '{print $1}' | tr -d '-')
            local FILE=$(echo "$line" | awk '{print $4}')

            if [[ "$DATE" < "$CUTOFF_DATE" ]]; then
                log "Deleting old file backup: $FILE"
                aws s3 rm "s3://$BACKUP_S3_BUCKET/$FILE" || true
            fi
        done

    # Clean up old configuration backups (keep monthly for 1 year)
    aws s3 ls "s3://$BACKUP_S3_BUCKET/configuration/" --recursive | \
        while read -r line; do
            local DATE=$(echo "$line" | awk '{print $1}' | tr -d '-')
            local FILE=$(echo "$line" | awk '{print $4}')
            local FILE_DATE=$(basename "$FILE" | grep -o '[0-9]\{8\}' || echo "")

            if [[ -n "$FILE_DATE" && "$FILE_DATE" < "$CUTOFF_DATE" ]]; then
                # Keep monthly backups
                local FILE_DAY=$(basename "$FILE" | grep -o '[0-9]\{2\}$' || echo "01")
                if [[ "$FILE_DAY" != "01" ]]; then
                    log "Deleting old configuration backup: $FILE"
                    aws s3 rm "s3://$BACKUP_S3_BUCKET/$FILE" || true
                fi
            fi
        done

    success "Old backups cleanup completed"
}

# Generate backup report
generate_report() {
    log "Generating backup report..."

    local REPORT_FILE="$BACKUP_DIR/backup-report-$(date +%Y%m%d-%H%M%S).json"

    # Get backup statistics
    local DB_BACKUPS=$(aws s3 ls "s3://$BACKUP_S3_BUCKET/database/" --recursive | wc -l)
    local FILE_BACKUPS=$(aws s3 ls "s3://$BACKUP_S3_BUCKET/files/" --recursive | wc -l)
    local CONFIG_BACKUPS=$(aws s3 ls "s3://$BACKUP_S3_BUCKET/configuration/" --recursive | wc -l)
    local TOTAL_SIZE=$(aws s3 ls "s3://$BACKUP_S3_BUCKET/" --recursive --summarize --human-readable | tail -1)

    # Create report
    cat > "$REPORT_FILE" <<EOF
{
    "backup_metadata": {
        "timestamp": "$(date -Iseconds)",
        "environment": "${ENVIRONMENT:-production}",
        "backup_type": "$BACKUP_TYPE",
        "initiated_by": "$(whoami)"
    },
    "backup_statistics": {
        "database_backups": $DB_BACKUPS,
        "file_backups": $FILE_BACKUPS,
        "configuration_backups": $CONFIG_BACKUPS,
        "total_storage_used": "$TOTAL_SIZE"
    },
    "backup_components": {
        "database": true,
        "files": true,
        "configuration": true,
        "logs": true
    },
    "retention_policy": {
        "days": $BACKUP_RETENTION_DAYS,
        "cleanup_completed": true
    }
}
EOF

    # Upload report to S3
    local S3_KEY="reports/$(basename "$REPORT_FILE")"
    aws s3 cp "$REPORT_FILE" "s3://$BACKUP_S3_BUCKET/$S3_KEY"

    success "Backup report generated and uploaded"
}

# Send notifications
send_notifications() {
    log "Sending backup notifications..."

    local STATUS="success"
    local EMOJI="✅"
    local COLOR="good"

    if [[ $? -ne 0 ]]; then
        STATUS="failure"
        EMOJI="❌"
        COLOR="danger"
    fi

    # Send Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local SLACK_MESSAGE="$EMOJI Backup $STATUS - $(date)"
        local SLACK_PAYLOAD=$(cat <<EOF
{
    "attachments": [
        {
            "color": "$COLOR",
            "title": "workshopsAI CMS Backup",
            "text": "$SLACK_MESSAGE",
            "fields": [
                {
                    "title": "Environment",
                    "value": "${ENVIRONMENT:-production}",
                    "short": true
                },
                {
                    "title": "Backup Type",
                    "value": "$BACKUP_TYPE",
                    "short": true
                },
                {
                    "title": "Retention",
                    "value": "$BACKUP_RETENTION_DAYS days",
                    "short": true
                },
                {
                    "title": "Initiated by",
                    "value": "$(whoami)",
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

    success "Notifications sent"
}

# Cleanup local files
cleanup_local() {
    log "Cleaning up local files..."
    rm -rf "$BACKUP_DIR"
    success "Local cleanup completed"
}

# Main execution
main() {
    local COMMAND=${1:-full}

    case $COMMAND in
        "full"|"database"|"files"|"configuration"|"logs"|"cleanup")
            log "Starting backup: $COMMAND"
            load_config
            init_backup

            case $COMMAND in
                "full")
                    backup_database
                    backup_files
                    backup_configuration
                    backup_logs
                    cleanup_old_backups
                    generate_report
                    ;;
                "database")
                    backup_database
                    ;;
                "files")
                    backup_files
                    ;;
                "configuration")
                    backup_configuration
                    ;;
                "logs")
                    backup_logs
                    ;;
                "cleanup")
                    cleanup_old_backups
                    ;;
            esac

            send_notifications
            cleanup_local
            success "Backup $COMMAND completed successfully!"
            ;;
        *)
            echo "Usage: $0 {full|database|files|configuration|logs|cleanup}"
            exit 1
            ;;
    esac
}

# Handle signals gracefully
trap 'error "Backup script interrupted"; cleanup_local; exit 1' INT TERM

# Run main function
main "$@"