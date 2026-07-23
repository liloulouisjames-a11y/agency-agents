#!/bin/bash
# Ollama model management utility

set -e

OLLAMA_HOST=${OLLAMA_HOST:-localhost:11434}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🦙 Ollama Model Manager${NC}"
echo "========================"
echo ""

# Check if Ollama is running
check_ollama() {
    if ! curl -s http://$OLLAMA_HOST/api/tags >/dev/null 2>&1; then
        echo -e "${RED}❌ Ollama server not running${NC}"
        echo "Start with: ./scripts/start-ollama.sh"
        return 1
    fi
    return 0
}

# List available models
list_models() {
    echo -e "${BLUE}Available Models:${NC}"
    echo ""

    response=$(curl -s http://$OLLAMA_HOST/api/tags)

    # Extract model names and display info
    echo "$response" | jq -r '.models[] | "\(.name) (\(.size / 1024 / 1024 / 1024 | round)GB)"' 2>/dev/null || \
        echo "No models found"

    echo ""
}

# Pull a model
pull_model() {
    local model=$1

    if [ -z "$model" ]; then
        echo "Usage: $0 pull <model-name>"
        echo ""
        echo "Available models:"
        echo "  mistral            - Fast, high-quality general model"
        echo "  neural-chat        - Conversational model"
        echo "  llama2             - General purpose model"
        echo "  codellama          - Code generation and analysis"
        echo "  dolphin-mixtral    - Advanced reasoning model"
        return 1
    fi

    echo -e "${YELLOW}Pulling model: $model${NC}"
    echo "(This may take several minutes depending on model size)"
    echo ""

    ollama pull "$model"

    echo -e "${GREEN}✅ Model $model pulled successfully${NC}"
}

# Delete a model
delete_model() {
    local model=$1

    if [ -z "$model" ]; then
        echo "Usage: $0 delete <model-name>"
        return 1
    fi

    echo -e "${YELLOW}Deleting model: $model${NC}"
    ollama rm "$model"
    echo -e "${GREEN}✅ Model $model deleted${NC}"
}

# Show model details
show_model_info() {
    local model=$1

    if [ -z "$model" ]; then
        echo "Usage: $0 info <model-name>"
        return 1
    fi

    echo -e "${BLUE}Model Information: $model${NC}"
    echo ""

    # Get model size
    response=$(curl -s http://$OLLAMA_HOST/api/tags)
    echo "$response" | jq ".models[] | select(.name == \"$model\")" 2>/dev/null || \
        echo "Model not found"

    echo ""
}

# Benchmark model
benchmark_model() {
    local model=$1
    local prompt="The future of artificial intelligence is"

    if [ -z "$model" ]; then
        echo "Usage: $0 benchmark <model-name>"
        return 1
    fi

    echo -e "${YELLOW}Benchmarking model: $model${NC}"
    echo "Prompt: $prompt"
    echo ""

    start_time=$(date +%s%N)

    response=$(curl -s -X POST http://$OLLAMA_HOST/api/generate \
        -H "Content-Type: application/json" \
        -d "{\"model\": \"$model\", \"prompt\": \"$prompt\", \"stream\": false}")

    end_time=$(date +%s%N)

    # Calculate elapsed time in seconds
    elapsed=$((($end_time - $start_time) / 1000000000))

    # Extract response
    generated=$(echo "$response" | jq -r '.response' 2>/dev/null)

    echo -e "${GREEN}Response:${NC}"
    echo "$generated"
    echo ""
    echo -e "${BLUE}Performance:${NC}"
    echo "  Time: ${elapsed}s"
    echo ""
}

# Show recommended models
show_recommendations() {
    echo -e "${BLUE}Recommended Models by Use Case:${NC}"
    echo ""
    echo "📝 General Purpose & Chat:"
    echo "  mistral       - Best balance of speed and quality (4.1GB)"
    echo "  neural-chat   - Optimized for conversations (3.8GB)"
    echo ""
    echo "💻 Code Generation:"
    echo "  codellama     - Specialized for programming tasks (3.8GB)"
    echo ""
    echo "🧠 Advanced Reasoning:"
    echo "  dolphin-mixtral  - Complex tasks and analysis (26GB)"
    echo ""
    echo "⚡ Lightweight (CPU Only):"
    echo "  mistral, neural-chat - Work well on most machines"
    echo ""
    echo "🚀 GPU Accelerated:"
    echo "  dolphin-mixtral, mistral:13b - Better quality with CUDA/Metal"
    echo ""
}

# Help message
show_help() {
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  list              - List downloaded models"
    echo "  pull <model>      - Download a model"
    echo "  delete <model>    - Delete a model"
    echo "  info <model>      - Show model details"
    echo "  benchmark <model> - Run performance benchmark"
    echo "  recommend         - Show model recommendations"
    echo "  help              - Show this help message"
    echo ""
}

# Main
main() {
    local command=$1

    # Check Ollama is running (except for some commands)
    if [[ "$command" != "help" && "$command" != "recommend" && "$command" != "" ]]; then
        if ! check_ollama; then
            exit 1
        fi
    fi

    case "$command" in
    list)
        list_models
        ;;
    pull)
        pull_model "$2"
        ;;
    delete)
        delete_model "$2"
        ;;
    info)
        show_model_info "$2"
        ;;
    benchmark)
        benchmark_model "$2"
        ;;
    recommend)
        show_recommendations
        ;;
    help | "")
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $command${NC}"
        show_help
        exit 1
        ;;
    esac
}

main "$@"
