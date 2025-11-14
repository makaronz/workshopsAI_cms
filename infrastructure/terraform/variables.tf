# Terraform variables for workshopsAI CMS deployment

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "workshopsai-cms"
}

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  validation {
    condition     = contains(["staging", "production", "development"], var.environment)
    error_message = "Environment must be one of: staging, production, development."
  }
}

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "private_subnets" {
  description = "List of private subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnets" {
  description = "List of public subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "database_subnets" {
  description = "List of database subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.201.0/24", "10.0.202.0/24", "10.0.203.0/24"]
}

# Application Configuration
variable "app_desired_count" {
  description = "Number of tasks to run initially"
  type        = number
  default     = 2
}

variable "app_min_capacity" {
  description = "Minimum number of tasks for auto scaling"
  type        = number
  default     = 1
}

variable "app_max_capacity" {
  description = "Maximum number of tasks for auto scaling"
  type        = number
  default     = 10
}

# Database Configuration
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"

  validation {
    condition     = contains(["db.t3.micro", "db.t3.small", "db.t3.medium", "db.t3.large", "db.t3.xlarge", "db.t3.2xlarge"], var.db_instance_class)
    error_message = "DB instance class must be a valid t3 instance class."
  }
}

variable "db_allocated_storage" {
  description = "Initial allocated storage for RDS (GB)"
  type        = number
  default     = 20

  validation {
    condition     = var.db_allocated_storage >= 20 && var.db_allocated_storage <= 65536
    error_message = "DB allocated storage must be between 20 and 65536 GB."
  }
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage for RDS (GB)"
  type        = number
  default     = 100

  validation {
    condition     = var.db_max_allocated_storage >= var.db_allocated_storage
    error_message = "DB max allocated storage must be greater than or equal to allocated storage."
  }
}

variable "db_backup_retention_period" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7

  validation {
    condition     = var.db_backup_retention_period >= 1 && var.db_backup_retention_period <= 35
    error_message = "DB backup retention period must be between 1 and 35 days."
  }
}

variable "db_name" {
  description = "Name of the database to create"
  type        = string
  default     = "workshopsai_cms"
}

variable "db_username" {
  description = "Master username for the database"
  type        = string
  default     = "workshopsai"
}

variable "db_password" {
  description = "Master password for the database"
  type        = string
  sensitive   = true
}

# Redis Configuration
variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.micro"

  validation {
    condition     = contains(["cache.t3.micro", "cache.t3.small", "cache.t3.medium", "cache.t3.large"], var.redis_node_type)
    error_message = "Redis node type must be a valid t3 cache instance class."
  }
}

variable "redis_auth_token" {
  description = "Auth token for Redis"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.redis_auth_token) >= 16 && length(var.redis_auth_token) <= 128
    error_message = "Redis auth token must be between 16 and 128 characters."
  }
}

# ECR Configuration
variable "ecr_repository_name" {
  description = "Name of the ECR repository"
  type        = string
  default     = "workshopsai-cms"
}

# SSL Configuration
variable "enable_ssl" {
  description = "Enable SSL termination at load balancer"
  type        = bool
  default     = true
}

variable "ssl_certificate_arn" {
  description = "ARN of the SSL certificate"
  type        = string
  default     = ""
}

# Domain Configuration
variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = ""
}

# SNS Configuration
variable "alert_email" {
  description = "Email address for alerts"
  type        = string
  default     = ""
}

# Monitoring Configuration
variable "enable_monitoring" {
  description = "Enable detailed CloudWatch monitoring"
  type        = bool
  default     = true
}

# Backup Configuration
variable "backup_schedule" {
  description = "Cron expression for backup schedule"
  type        = string
  default     = "0 2 * * *"
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30
}

# Security Configuration
variable "enable_encryption" {
  description = "Enable encryption for all resources"
  type        = bool
  default     = true
}

variable "enable_vpc_flow_logs" {
  description = "Enable VPC flow logs"
  type        = bool
  default     = true
}

# Cost Optimization
variable "enable_cost_optimization" {
  description = "Enable cost optimization features"
  type        = bool
  default     = true
}

variable "spot_instance_enabled" {
  description = "Enable spot instances for cost savings"
  type        = bool
  default     = false
}

# Feature Flags
variable "enable_feature_flags" {
  description = "Enable feature flags configuration"
  type        = bool
  default     = false
}

variable "feature_flags" {
  description = "Map of feature flags"
  type        = map(string)
  default     = {}
}

# Custom Tags
variable "custom_tags" {
  description = "Custom tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Environment-specific configurations
variable "staging_config" {
  description = "Staging environment specific configuration"
  type = object({
    app_desired_count     = optional(number, 1)
    db_instance_class    = optional(string, "db.t3.micro")
    redis_node_type      = optional(string, "cache.t3.micro")
    enable_monitoring    = optional(bool, true)
    backup_retention_days = optional(number, 7)
  })
  default = {}
}

variable "production_config" {
  description = "Production environment specific configuration"
  type = object({
    app_desired_count     = optional(number, 3)
    db_instance_class    = optional(string, "db.t3.medium")
    redis_node_type      = optional(string, "cache.t3.small")
    enable_monitoring    = optional(bool, true)
    backup_retention_days = optional(number, 30)
  })
  default = {}
}

# Advanced Configuration
variable "enable_advanced_logging" {
  description = "Enable advanced logging features"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "Number of days to retain logs"
  type        = number
  default     = 14
}

variable "enable_waf" {
  description = "Enable AWS WAF"
  type        = bool
  default     = false
}

variable "enable_shield" {
  description = "Enable AWS Shield Advanced"
  type        = bool
  default     = false
}

# Disaster Recovery
variable "enable_disaster_recovery" {
  description = "Enable disaster recovery configuration"
  type        = bool
  default     = false
}

variable "dr_region" {
  description = "Disaster recovery region"
  type        = string
  default     = "us-west-2"
}

# Compliance
variable "enable_compliance_logging" {
  description = "Enable compliance logging"
  type        = bool
  default     = false
}

variable "compliance_standards" {
  description = "Compliance standards to enforce"
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for standard in var.compliance_standards :
      contains(["SOC2", "HIPAA", "PCI-DSS", "GDPR"], standard)
    ])
    error_message = "Compliance standards must be one or more of: SOC2, HIPAA, PCI-DSS, GDPR."
  }
}