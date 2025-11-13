#!/bin/bash
# Lazy_Bird Setup Wizard
# Automate ANY development project while you sleep 🦜💤

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# OS detection
IS_DARWIN=false
IS_LINUX=false
case "$OSTYPE" in
    darwin*) IS_DARWIN=true ;;
    linux*) IS_LINUX=true ;;
esac

# Paths and service configuration
CONFIG_DIR="$HOME/.config/lazy_bird"
SECRETS_DIR="$CONFIG_DIR/secrets"
QUEUE_DIR="$CONFIG_DIR/queue"
LOG_DIR="$CONFIG_DIR/logs"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
SERVICE_LABEL="com.lazy-bird.issue-watcher"
SYSTEMD_SERVICE_PATH="$SYSTEMD_USER_DIR/issue-watcher.service"
PLIST_PATH="$HOME/Library/LaunchAgents/${SERVICE_LABEL}.plist"

# Phase 1.1: Multi-project support
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/scripts/wizard-multi-project.sh" ]; then
    source "$SCRIPT_DIR/scripts/wizard-multi-project.sh"
fi

# Phase 1.1: Projects array for multi-project configuration
declare -a PROJECTS

# Cross-platform RAM detection (Linux and macOS)
get_total_ram_gb() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        local mem_bytes=$(sysctl -n hw.memsize 2>/dev/null || echo "0")
        echo $((mem_bytes / 1024 / 1024 / 1024))
    else
        # Linux
        free -g | awk '/^Mem:/{print $2}' 2>/dev/null || echo "0"
    fi
}

get_used_ram_gb() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - calculate used RAM
        local total_mem=$(sysctl -n hw.memsize 2>/dev/null || echo "0")
        local free_mem=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
        local page_size=$(vm_stat | grep "page size" | awk '{print $8}')
        local free_bytes=$((free_mem * page_size))
        local used_bytes=$((total_mem - free_bytes))
        echo $((used_bytes / 1024 / 1024 / 1024))
    else
        # Linux
        free -g | awk '/^Mem:/{print $3}' 2>/dev/null || echo "0"
    fi
}

get_file_permissions() {
    local target=$1
    if [ ! -e "$target" ]; then
        echo ""
        return 0
    fi

    if $IS_DARWIN; then
        stat -f "%Lp" "$target"
    else
        stat -c "%a" "$target"
    fi
}

service_is_active() {
    if $IS_DARWIN; then
        launchctl list "$SERVICE_LABEL" >/dev/null 2>&1
    else
        systemctl --user is-active issue-watcher.service >/dev/null 2>&1
    fi
}

service_start_hint() {
    if $IS_DARWIN; then
        echo "launchctl load \"$PLIST_PATH\""
    else
        echo "systemctl --user start issue-watcher.service"
    fi
}

service_logs_hint() {
    if $IS_DARWIN; then
        echo "tail -f \"$LOG_DIR/issue-watcher.out.log\""
    else
        echo "journalctl --user -u issue-watcher.service -f"
    fi
}

# ASCII Art Logo
show_logo() {
    echo -e "${CYAN}"
    cat << 'EOF'
    🦜                                                      🦜
       _           _     ________  __     __
      | |         / \    |___  /   \ \   / /
      | |        / _ \      / /     \ \_/ /
      | |___    / ___ \    / /__     \   /
      |_____|  /_/   \_\  /_____|     |_|

       ____    ___   ____    ____
      | __ )  |_ _| |  _ \  |  _ \
      |  _ \   | |  | |_) | | | | |
      | |_) |  | |  |  _ <  | |_| |
      |____/  |___| |_| \_\ |____/
    💤                                                      💤

EOF
    echo -e "${NC}"
    echo -e "${MAGENTA}    Automate ANY development project while you sleep 🦜💤${NC}"
    echo -e "${BLUE}    Your AI-powered development assistant that works 24/7${NC}"
    echo ""
    echo -e "${BLUE}    Setup Wizard v2.0${NC}"
    echo ""
}

# Print section header
section() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC} $1"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Status indicators
success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Load framework preset from config/framework-presets.yml
load_framework_preset() {
    local framework_id=$1
    local presets_file="$(dirname "${BASH_SOURCE[0]}")/config/framework-presets.yml"

    if [ ! -f "$presets_file" ]; then
        warning "Framework presets file not found: $presets_file"
        return 1
    fi

    # Parse YAML using Python and export variables
    eval $(python3 -c "
import yaml
import sys

try:
    with open('$presets_file') as f:
        presets = yaml.safe_load(f)
        preset = presets.get('presets', {}).get('$framework_id')

        if not preset:
            print('PRESET_FOUND=false', file=sys.stderr)
            sys.exit(1)

        # Export commands (handle null values)
        test_cmd = preset.get('test_command', 'null')
        build_cmd = preset.get('build_command', 'null')
        lint_cmd = preset.get('lint_command', 'null')
        format_cmd = preset.get('format_command', 'null')

        # Quote strings properly for bash
        if test_cmd and test_cmd != 'null':
            print(f\"TEST_COMMAND='{test_cmd}'\")
        else:
            print('TEST_COMMAND=null')

        if build_cmd and build_cmd != 'null':
            print(f\"BUILD_COMMAND='{build_cmd}'\")
        else:
            print('BUILD_COMMAND=null')

        if lint_cmd and lint_cmd != 'null':
            print(f\"LINT_COMMAND='{lint_cmd}'\")
        else:
            print('LINT_COMMAND=null')

        if format_cmd and format_cmd != 'null':
            print(f\"FORMAT_COMMAND='{format_cmd}'\")
        else:
            print('FORMAT_COMMAND=null')

        print('PRESET_FOUND=true')

except Exception as e:
    print(f'PRESET_FOUND=false', file=sys.stderr)
    sys.exit(1)
" 2>&1)

    if [ "${PRESET_FOUND:-false}" != "true" ]; then
        return 1
    fi

    return 0
}

# Main wizard function
main() {
    clear
    show_logo

    section "Welcome to Lazy_Bird Setup Wizard"

    echo "This wizard will help you set up automated development with Claude Code."
    echo ""
    echo "What the wizard does:"
    echo "  ${GREEN}✓${NC} Validates your system (Phase 0)"
    echo "  ${GREEN}✓${NC} Detects capabilities (RAM, Claude CLI, Git)"
    echo "  ${GREEN}✓${NC} Asks 9 simple questions"
    echo "  ${GREEN}✓${NC} Installs appropriate phase automatically"
    echo "  ${GREEN}✓${NC} Configures all services"
    echo "  ${GREEN}✓${NC} Runs a test task to verify"
    echo ""

    read -p "Ready to begin? [Y/n]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]] && [[ ! -z $REPLY ]]; then
        echo "Setup cancelled."
        exit 0
    fi

    section "System Detection"

    # Detect RAM
    TOTAL_RAM=$(get_total_ram_gb)
    info "RAM: ${TOTAL_RAM}GB"

    if [ $TOTAL_RAM -lt 8 ]; then
        error "Insufficient RAM (${TOTAL_RAM}GB detected, 8GB minimum required)"
        echo ""
        echo "Lazy_Bird requires at least 8GB RAM to run."
        echo "Phase 1: 8GB minimum"
        echo "Phase 2-3: 10-14GB recommended"
        echo "Phase 4+: 16GB+ recommended"
        exit 1
    else
        success "RAM sufficient for Lazy_Bird"
    fi

    # Detect Godot
    if command -v godot &> /dev/null; then
        GODOT_VERSION=$(godot --version 2>&1 | head -1 || echo "unknown")
        success "Godot found: $GODOT_VERSION"
    else
        warning "Godot not found in PATH"
        info "Install from: https://godotengine.org/"
    fi

    # Detect Claude Code CLI
    if command -v claude &> /dev/null; then
        CLAUDE_VERSION=$(claude --version 2>&1 || echo "installed")
        success "Claude Code CLI found: $CLAUDE_VERSION"
    else
        error "Claude Code CLI not found"
        echo ""
        echo "Claude Code CLI is required for Lazy_Bird."
        echo "Install from: https://claude.ai/code"
        exit 1
    fi

    # Detect Git
    if command -v git &> /dev/null; then
        GIT_VERSION=$(git --version | cut -d' ' -f3)
        success "Git found: v$GIT_VERSION"
    else
        error "Git not found"
        exit 1
    fi

    # Detect Docker
    if command -v docker &> /dev/null; then
        if docker ps &> /dev/null 2>&1; then
            success "Docker available and running"
        else
            warning "Docker installed but daemon not running"
        fi
    else
        warning "Docker not available (Phase 3+ features will be limited)"
    fi

    section "Phase 0: Validation (REQUIRED)"

    echo "Before installation, we must validate all assumptions."
    echo "This ensures Claude Code CLI, Godot, and git worktrees work correctly."
    echo ""

    read -p "Run Phase 0 validation now? [Y/n]: " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        # Get script directory
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

        # Check if Phase 0 validation script exists
        if [ -f "$SCRIPT_DIR/scripts/validate-claude.sh" ]; then
            # We need a project path for validation
            read -p "Enter path to test Godot project for validation: " TEST_PROJECT
            TEST_PROJECT="${TEST_PROJECT/#\~/$HOME}"

            if [ ! -d "$TEST_PROJECT" ]; then
                warning "Test project not found, skipping Phase 0 validation"
            else
                info "Running Phase 0 validation..."
                if "$SCRIPT_DIR/scripts/validate-claude.sh"; then
                    success "Phase 0 validation passed!"
                else
                    error "Phase 0 validation failed"
                    echo ""
                    echo "You can:"
                    echo "  1. Fix the issues and run wizard again"
                    echo "  2. Skip validation: Continue anyway (not recommended)"
                    read -p "Continue anyway? [y/N]: " -n 1 -r
                    echo
                    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                        exit 1
                    fi
                    warning "Continuing without validation"
                fi
            fi
        else
            warning "Phase 0 validation scripts not found, skipping..."
        fi
    else
        warning "Skipping Phase 0 validation (not recommended)"
    fi

    section "Configuration Questions"

    echo "Please answer the following questions to configure your system."
    echo ""

    # Question 1: Project Type Category
    echo "❓ [1/9] What type of project are you working on?"
    echo "  1) Game Engine"
    echo "  2) Backend Framework"
    echo "  3) Frontend Framework"
    echo "  4) Programming Language (General)"
    echo "  5) Custom (manual configuration)"
    read -p "Select [1-5]: " PROJECT_CATEGORY_CHOICE

    # Question 1b: Specific Framework (based on category)
    FRAMEWORK_TYPE=""
    TEST_COMMAND="null"
    BUILD_COMMAND="null"
    LINT_COMMAND="null"
    FORMAT_COMMAND="null"

    case "$PROJECT_CATEGORY_CHOICE" in
        1) # Game Engine
            echo ""
            echo "❓ [1b/9] Which game engine?"
            echo "  1) Godot (GDScript, gdUnit4)"
            echo "  2) Unity (C#, NUnit)"
            echo "  3) Unreal Engine (C++, Automation)"
            echo "  4) Bevy (Rust, cargo test)"
            echo "  5) Other (manual config)"
            read -p "Select [1-5]: " FRAMEWORK_CHOICE

            case "$FRAMEWORK_CHOICE" in
                1) FRAMEWORK_TYPE="godot" ;;
                2) FRAMEWORK_TYPE="unity" ;;
                3) FRAMEWORK_TYPE="unreal" ;;
                4) FRAMEWORK_TYPE="bevy" ;;
                *) FRAMEWORK_TYPE="custom" ;;
            esac
            ;;
        2) # Backend Framework
            echo ""
            echo "❓ [1b/9] Which backend framework?"
            echo "  1) Django (Python)"
            echo "  2) Flask (Python)"
            echo "  3) FastAPI (Python)"
            echo "  4) Express (Node.js)"
            echo "  5) Rails (Ruby)"
            echo "  6) Other (manual config)"
            read -p "Select [1-6]: " FRAMEWORK_CHOICE

            case "$FRAMEWORK_CHOICE" in
                1) FRAMEWORK_TYPE="django" ;;
                2) FRAMEWORK_TYPE="flask" ;;
                3) FRAMEWORK_TYPE="fastapi" ;;
                4) FRAMEWORK_TYPE="express" ;;
                5) FRAMEWORK_TYPE="rails" ;;
                *) FRAMEWORK_TYPE="custom" ;;
            esac
            ;;
        3) # Frontend Framework
            echo ""
            echo "❓ [1b/9] Which frontend framework?"
            echo "  1) React (JavaScript/TypeScript)"
            echo "  2) Vue.js (JavaScript/TypeScript)"
            echo "  3) Angular (TypeScript)"
            echo "  4) Svelte (JavaScript/TypeScript)"
            echo "  5) Other (manual config)"
            read -p "Select [1-5]: " FRAMEWORK_CHOICE

            case "$FRAMEWORK_CHOICE" in
                1) FRAMEWORK_TYPE="react" ;;
                2) FRAMEWORK_TYPE="vue" ;;
                3) FRAMEWORK_TYPE="angular" ;;
                4) FRAMEWORK_TYPE="svelte" ;;
                *) FRAMEWORK_TYPE="custom" ;;
            esac
            ;;
        4) # Programming Language
            echo ""
            echo "❓ [1b/9] Which programming language?"
            echo "  1) Python (pytest)"
            echo "  2) Rust (cargo)"
            echo "  3) Go (go test)"
            echo "  4) Node.js (Jest)"
            echo "  5) C/C++ (make)"
            echo "  6) Java (Maven)"
            echo "  7) Other (manual config)"
            read -p "Select [1-7]: " FRAMEWORK_CHOICE

            case "$FRAMEWORK_CHOICE" in
                1) FRAMEWORK_TYPE="python" ;;
                2) FRAMEWORK_TYPE="rust" ;;
                3) FRAMEWORK_TYPE="go" ;;
                4) FRAMEWORK_TYPE="nodejs" ;;
                5) FRAMEWORK_TYPE="cpp" ;;
                6) FRAMEWORK_TYPE="java" ;;
                *) FRAMEWORK_TYPE="custom" ;;
            esac
            ;;
        *) # Custom
            FRAMEWORK_TYPE="custom"
            warning "Custom configuration selected - you'll need to manually configure test/build commands"
            ;;
    esac

    # Load framework preset if not custom
    if [ "$FRAMEWORK_TYPE" != "custom" ]; then
        info "Loading $FRAMEWORK_TYPE preset..."
        if load_framework_preset "$FRAMEWORK_TYPE"; then
            success "Framework preset loaded: $FRAMEWORK_TYPE"
        else
            warning "Failed to load preset for $FRAMEWORK_TYPE, using manual config"
            FRAMEWORK_TYPE="custom"
        fi
    fi

    success "Project type: $FRAMEWORK_TYPE"
    echo ""

    # Question 2: Project Location
    read -p "❓ [2/9] Enter your project path: " PROJECT_PATH
    PROJECT_PATH="${PROJECT_PATH/#\~/$HOME}"

    if [ ! -d "$PROJECT_PATH" ]; then
        error "Directory does not exist: $PROJECT_PATH"
        exit 1
    fi

    if [ ! -d "$PROJECT_PATH/.git" ]; then
        error "Not a git repository: $PROJECT_PATH"
        exit 1
    fi

    success "Project path: $PROJECT_PATH"
    echo ""

    # Question 3: Git Platform
    echo "❓ [3/9] Which git platform are you using?"
    echo "  1) GitHub"
    echo "  2) GitLab"
    read -p "Select [1-2]: " GIT_PLATFORM_CHOICE

    case "$GIT_PLATFORM_CHOICE" in
        1)
            GIT_PLATFORM="github"
            ;;
        2)
            GIT_PLATFORM="gitlab"
            ;;
        *)
            GIT_PLATFORM="github"
            warning "Invalid choice, defaulting to GitHub"
            ;;
    esac

    success "Platform: $GIT_PLATFORM"
    echo ""

    # Question 4: Repository Details
    read -p "❓ [4/9] Enter your repository URL: " REPOSITORY
    success "Repository: $REPOSITORY"
    echo ""

    # Question 5: API Token
    read -sp "❓ [5/9] Enter your $GIT_PLATFORM API token (input hidden): " API_TOKEN
    echo ""

    if [ -z "$API_TOKEN" ]; then
        error "API token cannot be empty"
        exit 1
    fi

    success "API token received (will be stored securely)"
    echo ""

    # Question 6: Notifications
    echo "❓ [6/9] Enable notifications?"
    echo "  1) Yes, via ntfy.sh (recommended)"
    echo "  2) No notifications"
    read -p "Select [1-2]: " NOTIFICATIONS_CHOICE

    case "$NOTIFICATIONS_CHOICE" in
        1)
            NOTIFICATIONS_ENABLED=true
            read -p "Enter ntfy.sh topic (e.g., my-game-dev): " NTFY_TOPIC
            ;;
        *)
            NOTIFICATIONS_ENABLED=false
            NTFY_TOPIC=""
            ;;
    esac

    success "Notifications: $([ "$NOTIFICATIONS_ENABLED" = true ] && echo "enabled ($NTFY_TOPIC)" || echo "disabled")"
    echo ""

    # Question 7: Resource Allocation
    read -p "❓ [7/9] Maximum RAM per agent in GB [default: 10]: " MAX_RAM
    MAX_RAM="${MAX_RAM:-10}"

    if ! [[ "$MAX_RAM" =~ ^[0-9]+$ ]]; then
        error "Invalid RAM value"
        exit 1
    fi

    success "Agent RAM limit: ${MAX_RAM}GB"
    echo ""

    # Question 8: Starting Phase
    echo "❓ [8/9] Starting Phase:"
    echo "  Phase 1: Single Agent Sequential (recommended for initial setup)"
    PHASE=1
    success "Phase: $PHASE"
    echo ""

    section "Installation"

    echo "Installing Lazy_Bird with your configuration..."
    echo ""

    # Create directory structure
    info "Creating directory structure..."
    mkdir -p "$CONFIG_DIR"/{logs,data,queue,secrets}
    success "Created $CONFIG_DIR/"

    # Generate configuration file
    info "Generating configuration..."
    cat > "$CONFIG_DIR/config.yml" <<EOF
# Lazy_Bird Configuration
# Generated by wizard on $(date)

# Project Configuration
project:
  type: $FRAMEWORK_TYPE
  name: "My Project"
  path: $PROJECT_PATH

# Framework Commands
test_command: $TEST_COMMAND
build_command: $BUILD_COMMAND
lint_command: $LINT_COMMAND
format_command: $FORMAT_COMMAND

# Git Configuration
git_platform: $GIT_PLATFORM
repository: $REPOSITORY
poll_interval_seconds: 60

# Phase Configuration
phase: $PHASE
max_concurrent_agents: 1
memory_limit_gb: $MAX_RAM

# Notifications
notifications:
  enabled: $NOTIFICATIONS_ENABLED
  method: $([ "$NOTIFICATIONS_ENABLED" = true ] && echo "ntfy" || echo "none")
  topic: "$NTFY_TOPIC"
EOF
    success "Configuration saved to $CONFIG_DIR/config.yml"

    # Store API token securely
    info "Storing API token securely..."
    echo "$API_TOKEN" > "$SECRETS_DIR/${GIT_PLATFORM}_token"
    chmod 600 "$SECRETS_DIR/${GIT_PLATFORM}_token"
    chmod 700 "$SECRETS_DIR"
    success "API token stored (chmod 600)"

    # Install background service for issue-watcher
    if $IS_DARWIN; then
        info "Installing issue-watcher launchd service..."

        mkdir -p "$(dirname "$PLIST_PATH")"

        cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$SERVICE_LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/env</string>
        <string>python3</string>
        <string>$SCRIPT_DIR/scripts/issue-watcher.py</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/issue-watcher.out.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/issue-watcher.err.log</string>
    <key>WorkingDirectory</key>
    <string>$SCRIPT_DIR</string>
</dict>
</plist>
EOF

        launchctl unload "$PLIST_PATH" >/dev/null 2>&1 || true
        if launchctl load "$PLIST_PATH" >/dev/null 2>&1; then
            success "Issue watcher launchd service installed and loaded"
        else
            warning "Failed to load launchd service"
            info "Load manually with: launchctl load \"$PLIST_PATH\""
        fi
    else
        info "Installing issue-watcher systemd service..."

        mkdir -p "$SYSTEMD_USER_DIR"

        cat > "$SYSTEMD_SERVICE_PATH" <<EOF
[Unit]
Description=Lazy_Bird Issue Watcher Service
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/env python3 $SCRIPT_DIR/scripts/issue-watcher.py
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
EOF

        systemctl --user daemon-reload
        systemctl --user enable issue-watcher.service 2>&1 || warning "Failed to enable service"
        systemctl --user start issue-watcher.service 2>&1 || warning "Failed to start service"

        sleep 2
        if service_is_active; then
            success "Issue watcher service installed and started"
        else
            warning "Issue watcher service installed but not running"
            info "Start manually with: $(service_start_hint)"
        fi
    fi

    echo ""

    section "Installation Complete!"

    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              Setup Wizard Completed! 🎉                ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    if service_is_active; then
        ISSUE_WATCHER_STATUS="Active     "
    else
        ISSUE_WATCHER_STATUS="Inactive   "
    fi

    echo "┌─────────────────────────────────────────────┐"
    echo "│  ✅ Installation Complete!                  │"
    echo "│                                             │"
    echo "│  📋 Issue Watcher: $ISSUE_WATCHER_STATUS                 │"
    echo "│  🤖 Agent Slots: 1 available                │"
    $([ "$NOTIFICATIONS_ENABLED" = true ] && echo "│  🔔 Notifications: ntfy.sh/$NTFY_TOPIC      │")
    echo "│                                             │"
    echo "│  🎯 Next Steps:                             │"
    echo "│                                             │"
    echo "│  1. Create your first task:                 │"
    echo "│     gh issue create --template task \\       │"
    echo "│       --title \"Add player health\" \\        │"
    echo "│       --label \"ready\"                       │"
    echo "│                                             │"
    echo "│  2. Watch progress:                         │"
    echo "│     ./wizard.sh --status                    │"
    echo "│                                             │"
    echo "│  3. Check system health:                    │"
    echo "│     ./wizard.sh --health                    │"
    echo "│                                             │"
    echo "│  📚 Documentation: ./Docs/README.md         │"
    echo "│  🆘 Help: ./wizard.sh --help                │"
    echo "│                                             │"
    echo "└─────────────────────────────────────────────┘"
    echo ""
    echo -e "${MAGENTA}🦜 Fly lazy, code smart!${NC}"
    echo ""
}

# Status command
cmd_status() {
    show_logo
    section "Lazy_Bird Status Report"

    # Check if config exists
    if [ ! -f "$CONFIG_DIR/config.yml" ]; then
        error "Configuration not found"
        echo "Run ./wizard.sh to set up Lazy_Bird"
        exit 1
    fi

    echo "📊 System Health"
    echo ""

    # Check issue watcher
    if service_is_active; then
        success "Issue Watcher: Running"
        if $IS_DARWIN; then
            if [ -f "$LOG_DIR/issue-watcher.out.log" ]; then
                LAST_CHECK=$(tail -1 "$LOG_DIR/issue-watcher.out.log" 2>/dev/null | cut -c1-40)
                [ -n "$LAST_CHECK" ] && info "  Last log: $LAST_CHECK"
            fi
        else
            LAST_CHECK=$(journalctl --user -u issue-watcher.service -n 1 --no-pager 2>/dev/null | tail -1 | awk '{print $1, $2, $3}')
            [ -n "$LAST_CHECK" ] && info "  Last check: $LAST_CHECK"
        fi
    else
        error "Issue Watcher: Not running"
        info "  Start with: $(service_start_hint)"
    fi
    echo ""

    # Check queue
    if [ -d "$QUEUE_DIR" ]; then
        QUEUE_COUNT=$(find "$QUEUE_DIR" -name "task-*.json" 2>/dev/null | wc -l)
        if [ "$QUEUE_COUNT" -gt 0 ]; then
            info "📋 Task Queue: $QUEUE_COUNT tasks pending"
            echo ""
            echo "Pending tasks:"
            find "$QUEUE_DIR" -name "task-*.json" | while read task_file; do
                TASK_ID=$(basename "$task_file" | sed 's/task-\(.*\)\.json/\1/')
                TASK_TITLE=$(jq -r '.title' "$task_file" 2>/dev/null || echo "Unknown")
                echo "  - #$TASK_ID: $TASK_TITLE"
            done
        else
            success "📋 Task Queue: Empty (no pending tasks)"
        fi
    else
        warning "📋 Task Queue: Directory not found"
    fi
    echo ""

    # Check recent logs
    if [ -d "$LOG_DIR" ]; then
        RECENT_LOGS=$(find "$LOG_DIR" -name "agent-task-*.log" -mtime -1 2>/dev/null | wc -l)
        if [ "$RECENT_LOGS" -gt 0 ]; then
            info "📊 Recent Activity: $RECENT_LOGS tasks in last 24h"
            echo ""
            echo "Recent logs:"
            find "$LOG_DIR" -name "agent-task-*.log" -mtime -1 | head -5 | while read log_file; do
                TASK_ID=$(basename "$log_file" | sed 's/agent-task-\(.*\)\.log/\1/')
                echo "  - Task #$TASK_ID: $log_file"
            done
        else
            info "📊 Recent Activity: No tasks in last 24h"
        fi
    fi
    echo ""

    # Check resource usage
    TOTAL_RAM=$(get_total_ram_gb)
    USED_RAM=$(get_used_ram_gb)
    RAM_PERCENT=$((USED_RAM * 100 / TOTAL_RAM))

    info "💾 Resource Usage"
    echo "  RAM: ${USED_RAM}GB / ${TOTAL_RAM}GB ($RAM_PERCENT%)"
    echo ""

    # Show next steps
    echo "Next commands:"
    echo "  ./wizard.sh --health    - Run health checks"
    echo "  $(service_logs_hint)  - View live logs"
    echo ""
}

# Health command
cmd_health() {
    show_logo
    section "Health Diagnostics"

    echo "🔍 Running health checks..."
    echo ""

    CHECKS_PASSED=0
    CHECKS_FAILED=0

    # Check 1: Configuration file
    echo -n "Config file... "
    if [ -f "$CONFIG_DIR/config.yml" ]; then
        echo -e "${GREEN}✓${NC}"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC}"
        ((CHECKS_FAILED++))
    fi

    # Check 2: Secrets
    echo -n "API token... "
    if [ -f "$SECRETS_DIR/github_token" ] || [ -f "$SECRETS_DIR/gitlab_token" ]; then
        # Check permissions
        TOKEN_FILE=$(find "$SECRETS_DIR/" -name "*_token" | head -1)
        PERMS=$(get_file_permissions "$TOKEN_FILE")
        if [ "$PERMS" = "600" ]; then
            echo -e "${GREEN}✓${NC}"
            ((CHECKS_PASSED++))
        else
            echo -e "${YELLOW}⚠${NC} (wrong permissions: $PERMS)"
            ((CHECKS_FAILED++))
        fi
    else
        echo -e "${RED}✗${NC}"
        ((CHECKS_FAILED++))
    fi

    # Check 3: Issue watcher service
    echo -n "Issue watcher service... "
    if service_is_active; then
        echo -e "${GREEN}✓${NC}"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC}"
        ((CHECKS_FAILED++))
    fi

    # Check 4: Scripts exist
    echo -n "Agent runner script... "
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [ -f "$SCRIPT_DIR/scripts/agent-runner.sh" ]; then
        echo -e "${GREEN}✓${NC}"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC}"
        ((CHECKS_FAILED++))
    fi

    # Check 5: Issue watcher script
    echo -n "Issue watcher script... "
    if [ -f "$SCRIPT_DIR/scripts/issue-watcher.py" ]; then
        echo -e "${GREEN}✓${NC}"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC}"
        ((CHECKS_FAILED++))
    fi

    # Check 6: Claude CLI
    echo -n "Claude Code CLI... "
    if command -v claude &>/dev/null; then
        echo -e "${GREEN}✓${NC}"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC}"
        ((CHECKS_FAILED++))
    fi

    # Check 7: Git
    echo -n "Git... "
    if command -v git &>/dev/null; then
        echo -e "${GREEN}✓${NC}"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC}"
        ((CHECKS_FAILED++))
    fi

    # Check 8: GitHub CLI
    echo -n "GitHub CLI... "
    if command -v gh &>/dev/null; then
        # Test authentication
        if gh auth status &>/dev/null; then
            echo -e "${GREEN}✓${NC}"
            ((CHECKS_PASSED++))
        else
            echo -e "${YELLOW}⚠${NC} (not authenticated)"
            ((CHECKS_FAILED++))
        fi
    else
        echo -e "${RED}✗${NC}"
        ((CHECKS_FAILED++))
    fi

    # Check 9: Project path
    echo -n "Project path... "
    if [ -f "$CONFIG_DIR/config.yml" ]; then
        # Try new schema first (project.path), fallback to old schema (godot_project_path)
        PROJECT_PATH=$(grep "path:" "$CONFIG_DIR/config.yml" | grep -v "^#" | head -1 | awk '{print $2}')
        if [ -z "$PROJECT_PATH" ]; then
            PROJECT_PATH=$(grep "godot_project_path:" "$CONFIG_DIR/config.yml" | awk '{print $2}')
        fi
        if [ -d "$PROJECT_PATH" ]; then
            echo -e "${GREEN}✓${NC}"
            ((CHECKS_PASSED++))
        else
            echo -e "${RED}✗${NC}"
            ((CHECKS_FAILED++))
        fi
    else
        echo -e "${RED}✗${NC}"
        ((CHECKS_FAILED++))
    fi

    # Check 10: RAM
    echo -n "System RAM... "
    TOTAL_RAM=$(get_total_ram_gb)
    if [ "$TOTAL_RAM" -ge 8 ]; then
        echo -e "${GREEN}✓${NC} (${TOTAL_RAM}GB)"
        ((CHECKS_PASSED++))
    else
        echo -e "${YELLOW}⚠${NC} (${TOTAL_RAM}GB, 8GB+ recommended)"
        ((CHECKS_FAILED++))
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Results: $CHECKS_PASSED passed, $CHECKS_FAILED failed"
    echo ""

    if [ "$CHECKS_FAILED" -eq 0 ]; then
        success "Overall Health: HEALTHY ✅"
        echo ""
        echo "Your system is ready to process tasks!"
    elif [ "$CHECKS_FAILED" -le 2 ]; then
        warning "Overall Health: DEGRADED ⚠️"
        echo ""
        echo "Some components need attention, but system is operational."
    else
        error "Overall Health: UNHEALTHY ❌"
        echo ""
        echo "Critical issues detected. Please fix before using Lazy_Bird."
    fi

    echo ""
    echo "For detailed logs:"
    echo "  $(service_logs_hint)"
    echo ""
}

# Command handling
case "${1:-}" in
    --status)
        cmd_status
        ;;
    --health)
        cmd_health
        ;;
    --upgrade)
        show_logo
        section "Upgrade Wizard"
        info "Upgrade functionality will be implemented in next version"
        ;;
    --weekly-review)
        show_logo
        section "Weekly Review"
        info "Weekly review will be implemented in next version"
        ;;
    --add-project)
        show_logo
        section "Add New Project"
        echo "This will add a project to your existing Lazy_Bird configuration."
        echo ""
        if [ -f "$CONFIG_DIR/config.yml" ]; then
            if type -t add_project_to_config > /dev/null 2>&1; then
                add_project_to_config
            else
                error "Multi-project functions not loaded. Please reinstall Lazy_Bird."
                exit 1
            fi
        else
            error "No existing configuration found. Run ./wizard.sh first."
            exit 1
        fi
        ;;
    --help)
        show_logo
        section "Lazy_Bird Wizard Help"
        echo "Usage: ./wizard.sh [command]"
        echo ""
        echo "Commands:"
        echo "  (no args)        - Run setup wizard"
        echo "  --add-project    - Add project to existing setup (Phase 1.1+)"
        echo "  --status         - Show system status"
        echo "  --health         - Run health checks"
        echo "  --upgrade        - Upgrade to next phase"
        echo "  --weekly-review  - Generate weekly progress report"
        echo "  --help           - Show this help"
        echo ""
        ;;
    *)
        main
        ;;
esac
