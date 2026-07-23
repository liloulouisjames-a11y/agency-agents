#!/bin/bash
# Start Ollama server with configuration

set -e

echo "🦙 Starting Ollama Server"
echo "========================"
echo ""

# Load environment variables if available
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
    echo "✅ Loaded environment from .env"
fi

# Default configuration
OLLAMA_HOST=${OLLAMA_HOST:-localhost:11434}
OLLAMA_KEEP_ALIVE=${OLLAMA_KEEP_ALIVE:-5m}
OLLAMA_NUM_PARALLEL=${OLLAMA_NUM_PARALLEL:-1}
OLLAMA_DEBUG=${OLLAMA_DEBUG:-false}

echo "Configuration:"
echo "  Host: $OLLAMA_HOST"
echo "  Keep Alive: $OLLAMA_KEEP_ALIVE"
echo "  Parallel: $OLLAMA_NUM_PARALLEL"
echo "  Debug: $OLLAMA_DEBUG"
echo ""

# Check if Ollama is installed
if ! command -v ollama >/dev/null 2>&1; then
    echo "❌ Ollama not found. Install from https://ollama.ai"
    exit 1
fi

# Check if server is already running
if curl -s http://$OLLAMA_HOST/api/tags >/dev/null 2>&1; then
    echo "⚠️  Ollama server already running on $OLLAMA_HOST"
    echo "   Use 'killall ollama' to stop it"
    exit 1
fi

# Start server
echo "Starting server on http://$OLLAMA_HOST..."
echo ""

export OLLAMA_HOST=$OLLAMA_HOST
export OLLAMA_KEEP_ALIVE=$OLLAMA_KEEP_ALIVE
export OLLAMA_NUM_PARALLEL=$OLLAMA_NUM_PARALLEL

if [ "$OLLAMA_DEBUG" = "true" ]; then
    export OLLAMA_DEBUG=1
    ollama serve
else
    ollama serve
fi
