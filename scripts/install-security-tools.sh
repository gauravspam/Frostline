#!/bin/bash
# Install local security tools (run once per machine)
# All tools are free with NO limits

set -euo pipefail

echo "Installing local security tools..."

# Detect OS
OS="$(uname -s)"
ARCH="$(uname -m)"

# Install pre-commit
if ! command -v pre-commit &> /dev/null; then
    echo "Installing pre-commit..."
    pip install pre-commit
fi

# Install gitleaks
if ! command -v gitleaks &> /dev/null; then
    echo "Installing gitleaks..."
    if [[ "$OS" == "Darwin" ]]; then
        brew install gitleaks
    elif [[ "$OS" == "Linux" ]]; then
        curl -sSfL "https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks_${OS}_${ARCH}.tar.gz" | tar -xz -C /usr/local/bin gitleaks
    elif [[ "$OS" == "MINGW"* ]] || [[ "$OS" == "MSYS"* ]] || [[ "$OS" == "CYGWIN"* ]]; then
        # Windows with Git Bash
        curl -sSfL "https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks_Windows_x64.zip" -o /tmp/gitleaks.zip
        unzip -o /tmp/gitleaks.zip -d /usr/local/bin/
    fi
fi

# Install Trivy
if ! command -v trivy &> /dev/null; then
    echo "Installing Trivy..."
    if [[ "$OS" == "Darwin" ]]; then
        brew install aquasecurity/trivy/trivy
    elif [[ "$OS" == "Linux" ]]; then
        wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
        echo "deb https://aquasecurity.github.io/trivy-repo/deb stable main" | sudo tee /etc/apt/sources.list.d/trivy.list
        sudo apt update && sudo apt install trivy
    elif [[ "$OS" == "MINGW"* ]] || [[ "$OS" == "MSYS"* ]] || [[ "$OS" == "CYGWIN"* ]]; then
        # Windows - download binary
        curl -sSfL "https://github.com/aquasecurity/trivy/releases/latest/download/trivy_Windows-64bit.zip" -o /tmp/trivy.zip
        unzip -o /tmp/trivy.zip -d /usr/local/bin/
    fi
fi

# Install semgrep
if ! command -v semgrep &> /dev/null; then
    echo "Installing semgrep..."
    pip install semgrep
fi

# Install hooks
echo "Installing pre-commit hooks..."
pre-commit install
pre-commit install --hook-type commit-msg

echo ""
echo "=== Installation complete! ==="
echo ""
echo "Installed tools:"
echo "  - pre-commit"
command -v gitleaks &> /dev/null && echo "  - gitleaks: $(gitleaks version)"
command -v trivy &> /dev/null && echo "  - trivy: $(trivy --version | head -1)"
command -v semgrep &> /dev/null && echo "  - semgrep: $(semgrep --version)"
echo ""
echo "Test with: pre-commit run --all-files"
echo "Scan with: trivy fs --severity CRITICAL,HIGH ."