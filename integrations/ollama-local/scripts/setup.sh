#!/bin/bash
# Setup script for Ollama local integration

set -e

echo "🦙 Ollama Local Integration Setup"
echo "=================================="
echo ""

# Detect OS
OS="$(uname -s)"
ARCH="$(uname -m)"

echo "System Information:"
echo "  OS: $OS"
echo "  Architecture: $ARCH"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install Ollama
install_ollama() {
    echo "Installing Ollama..."

    case "$OS" in
    Darwin)
        # macOS
        if command_exists brew; then
            brew install ollama
        else
            echo "Homebrew not found. Download from https://ollama.ai"
            exit 1
        fi
        ;;
    Linux)
        # Linux
        curl -fsSL https://ollama.ai/install.sh | sh
        ;;
    MINGW* | MSYS* | CYGWIN*)
        # Windows
        echo "Windows detected. Please download from https://ollama.ai/download"
        exit 1
        ;;
    *)
        echo "Unsupported OS: $OS"
        exit 1
        ;;
    esac

    echo "✅ Ollama installed successfully"
}

# Function to setup Python environment
setup_python_env() {
    echo ""
    echo "Setting up Python environment..."

    # Check Python version
    if ! command_exists python3; then
        echo "❌ Python 3 not found. Please install Python 3.8+"
        exit 1
    fi

    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    echo "  Python version: $PYTHON_VERSION"

    # Create virtual environment
    if [ ! -d "venv" ]; then
        echo "  Creating virtual environment..."
        python3 -m venv venv
    fi

    # Activate virtual environment
    source venv/bin/activate

    # Install dependencies
    echo "  Installing dependencies..."
    pip install --upgrade pip
    pip install -r requirements.txt

    echo "✅ Python environment ready"
    echo "   Activate with: source venv/bin/activate"
}

# Function to pull models
pull_models() {
    echo ""
    echo "Pulling Ollama models..."

    if ! command_exists ollama; then
        echo "❌ Ollama not found in PATH. Please restart terminal or install manually."
        return
    fi

    # Start Ollama server in background
    echo "  Starting Ollama server..."
    ollama serve >/dev/null 2>&1 &
    OLLAMA_PID=$!

    # Wait for server to start
    sleep 2

    # Pull default model
    echo "  Pulling mistral model (this may take a few minutes)..."
    ollama pull mistral

    echo "  Pulling neural-chat model..."
    ollama pull neural-chat

    # Stop server
    kill $OLLAMA_PID 2>/dev/null || true

    echo "✅ Models downloaded successfully"
}

# Function to create config files
setup_config() {
    echo ""
    echo "Setting up configuration files..."

    # Copy environment file
    if [ ! -f ".env" ]; then
        cp config/.env.example .env
        echo "  Created .env file (edit as needed)"
    else
        echo "  .env already exists"
    fi

    # Copy YAML config
    if [ ! -f ".ollama-config.yaml" ]; then
        cp config/ollama-config.yaml .ollama-config.yaml
        echo "  Created .ollama-config.yaml"
    fi

    echo "✅ Configuration ready"
}

# Function to verify setup
verify_setup() {
    echo ""
    echo "Verifying setup..."
    echo ""

    # Check Ollama
    if command_exists ollama; then
        echo "✅ Ollama installed"
    else
        echo "⚠️  Ollama not found in PATH (you may need to restart terminal)"
    fi

    # Check Python
    if command_exists python3; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
        if [[ "$PYTHON_VERSION" > "3.7" ]]; then
            echo "✅ Python 3.8+ installed"
        fi
    fi

    # Check dependencies
    if python3 -c "import openai; import anthropic; import pydantic" 2>/dev/null; then
        echo "✅ Python dependencies installed"
    fi

    echo ""
    echo "=================================="
    echo "✅ Setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. Start Ollama server:  ollama serve"
    echo "2. Pull models:          ollama pull mistral neural-chat"
    echo "3. Run examples:         python3 examples/openai_compatible_client.py"
    echo ""
    echo "Documentation: README.md"
}

# Main setup flow
main() {
    # Check if Ollama is installed
    if ! command_exists ollama; then
        echo "❓ Ollama not found. Install now? (y/n)"
        read -r response
        if [[ "$response" == "y" ]]; then
            install_ollama
        fi
    fi

    # Setup Python environment
    if [ -f "requirements.txt" ]; then
        setup_python_env
    fi

    # Setup configuration
    setup_config

    # Optionally pull models
    if command_exists ollama; then
        echo ""
        echo "❓ Download models now? This may take several minutes. (y/n)"
        read -r response
        if [[ "$response" == "y" ]]; then
            pull_models
        fi
    fi

    # Verify
    verify_setup
}

# Run main setup
main
