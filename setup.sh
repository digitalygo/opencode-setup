#!/usr/bin/env bash

set -euo pipefail

print_info() {
    echo "[INFO] $1"
}

print_error() {
    echo "[ERROR] $1" >&2
}

determine_user_home() {
    local -r current_user="${USER:-$(id -u -n)}"
    local user_home
    local home_owner
    
    if [ -n "${HOME:-}" ]; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            home_owner=$(stat -f %Su "$HOME" 2>/dev/null || true)
        else
            home_owner=$(stat -c %U "$HOME" 2>/dev/null || true)
        fi

        if [ -n "$home_owner" ] && [ "$home_owner" = "$current_user" ]; then
            user_home="$HOME"
        fi
    fi
    
    if [ -z "${user_home:-}" ]; then
        if command -v getent >/dev/null 2>&1; then
            user_home=$(getent passwd "$current_user" 2>/dev/null | cut -d: -f6 || true)
        else
            user_home=$(eval echo "~$current_user")
        fi
    fi
    
    if [ -z "$user_home" ] || [ "$user_home" = "~" ] || [[ "$user_home" == ~* ]]; then
        if [ -n "$user_home" ] && [ "$user_home" != "~" ] && [[ "$user_home" == ~* ]]; then
            user_home=$(eval echo "$user_home" 2>/dev/null || echo "")
        fi
        if [ -z "$user_home" ] || [ "$user_home" = "~" ] || [[ "$user_home" == ~* ]]; then
            print_error "Could not determine home directory for user: $current_user"
            exit 1
        fi
    fi
    
    echo "$user_home"
}

check_dependencies() {
    local missing_deps=()
    
    for cmd in curl git rsync mktemp; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            missing_deps+=("$cmd")
        fi
    done
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        exit 1
    fi
}

cleanup_temp_dir() {
    if [ -n "${TEMP_DIR:-}" ] && [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}

CHANNEL="stable"

parse_args() {
    while [ $# -gt 0 ]; do
        case "$1" in
            --channel)
                if [ $# -lt 2 ]; then
                    print_error "--channel requires an argument"
                    exit 1
                fi
                CHANNEL="$2"
                if [ "$CHANNEL" != "stable" ] && [ "$CHANNEL" != "beta" ] && [ "$CHANNEL" != "alpha" ]; then
                    print_error "Invalid channel: $CHANNEL (must be stable, beta, or alpha)"
                    exit 1
                fi
                shift 2
                ;;
            -*)
                print_error "Unknown option: $1"
                exit 1
                ;;
            *)
                print_error "Unknown argument: $1"
                exit 1
                ;;
        esac
    done
}

run_sync() {
    check_dependencies

    local user_home
    user_home=$(determine_user_home)

    readonly TARGET_DIR="$user_home/.config/opencode"
    readonly TEMP_DIR=$(mktemp -d)

    trap cleanup_temp_dir EXIT

    print_info "Target directory: $TARGET_DIR"
    print_info "Cloning repository..."

    if ! git clone --depth 1 https://github.com/digitalygo/opencode-setup.git "$TEMP_DIR"; then
        print_error "Failed to clone repository"
        exit 1
    fi

    readonly SOURCE_DIR="$TEMP_DIR"

    if [ ! -d "$SOURCE_DIR" ]; then
        print_error "Source directory not found in repository"
        exit 1
    fi

    local secrets_existed=false
    if [ -d "$TARGET_DIR/.secrets" ]; then
        secrets_existed=true
    fi

    print_info "Creating directories..."
    mkdir -p "$TARGET_DIR" "$TARGET_DIR/.secrets"

    print_info "Copying configuration files..."
    if ! rsync -av --delete --exclude=.git/ --exclude=.secrets/ --exclude=.github/ --exclude=thoughts/ --exclude=.gitignore --exclude=.markdownlint.json --exclude=.markdownlintignore --exclude=.releaserc.json "$SOURCE_DIR/" "$TARGET_DIR/"; then
        print_error "Failed to copy configuration files"
        exit 1
    fi

    if [ "$secrets_existed" = true ]; then
        print_info "Existing secrets were preserved"
    fi

    local shell_rc="$user_home/.bashrc"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        shell_rc="$user_home/.zshrc"
    fi

    print_info "Adding sync-opencode alias to $shell_rc..."
    local alias_line="alias sync-opencode='curl -fsSL https://raw.githubusercontent.com/digitalygo/opencode-setup/main/setup.sh | bash'"

    if [ ! -f "$shell_rc" ]; then
        touch "$shell_rc"
    fi

    if grep -Fxq "$alias_line" "$shell_rc" 2>/dev/null; then
        print_info "Alias already exists in $shell_rc"
    elif grep -qE '^[[:space:]]*alias[[:space:]]+sync-opencode=' "$shell_rc" 2>/dev/null; then
        local temp_rc
        local escaped_alias_line
        temp_rc=$(mktemp)
        escaped_alias_line=$(printf '%s\n' "$alias_line" | sed 's/[&/]/\\&/g')
        sed "0,/^[[:space:]]*alias[[:space:]]\+sync-opencode=.*/s//${escaped_alias_line}/" "$shell_rc" > "$temp_rc"
        mv "$temp_rc" "$shell_rc"
        print_info "Alias updated in $shell_rc"
    else
        echo "$alias_line" >> "$shell_rc"
        print_info "Alias added to $shell_rc"
    fi

    print_info "Setup completed successfully"
}

main() {
    parse_args "$@"
    run_sync
}

main "$@"