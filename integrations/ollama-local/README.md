# 🦙 Ollama Local Integration

Run powerful language models locally using **Ollama**, providing a private, offline-capable alternative to cloud-based API calls.

## What is Ollama?

[Ollama](https://ollama.ai) is a tool for running large language models locally on your machine. It provides:

- **Privacy**: All data stays on your machine
- **Offline capability**: No internet required after initial model download
- **Speed**: Low-latency inference on local hardware
- **Cost**: No per-token API charges
- **Model flexibility**: Support for Llama 2, Mistral, Neural Chat, CodeLlama, and many more

## Quick Start

### 1. Install Ollama

Download and install from [ollama.ai](https://ollama.ai):

```bash
# macOS
brew install ollama

# Linux
curl https://ollama.ai/install.sh | sh

# Windows
# Download from https://ollama.ai/download
```

### 2. Pull a Model

Start Ollama and pull a model:

```bash
# CPU-based (smaller, slower)
ollama pull mistral      # 4.1GB - Fast, quality model
ollama pull neural-chat  # 3.8GB - Conversational, good quality
ollama pull llama2       # 3.8GB - Solid all-purpose model

# GPU-accelerated options (if you have CUDA/Metal)
ollama pull mistral:13b  # 7.3GB - Better quality with GPU
ollama pull neural-chat:7b-q4  # 4.4GB - Quantized version
```

### 3. Start Ollama Server

```bash
ollama serve
# Server runs on http://localhost:11434
```

## Usage Examples

### Python with OpenAI SDK (Compatible API)

Ollama provides an OpenAI-compatible API endpoint, so you can use existing code:

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",  # dummy key, not used locally
)

response = client.chat.completions.create(
    model="mistral",
    messages=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain quantum computing in simple terms."},
    ],
)

print(response.choices[0].message.content)
```

### Direct Ollama API

```python
import requests
import json

def query_ollama(prompt, model="mistral"):
    url = "http://localhost:11434/api/generate"
    
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
    }
    
    response = requests.post(url, json=payload)
    return response.json()["response"]

# Usage
result = query_ollama("Write a Python function to calculate factorial")
print(result)
```

## Available Models

| Model | Size | Speed | Quality | Use Case |
|-------|------|-------|---------|----------|
| **mistral** | 4.1GB | ⚡ Fast | ⭐⭐⭐⭐ | General purpose, code |
| **neural-chat** | 3.8GB | ⚡ Fast | ⭐⭐⭐⭐ | Conversational, chat |
| **llama2** | 3.8GB | ⚡ Fast | ⭐⭐⭐ | General purpose |
| **dolphin-mixtral** | 26GB | 🚀 Slow | ⭐⭐⭐⭐⭐ | Advanced reasoning |
| **codellama** | 3.8GB | ⚡ Fast | ⭐⭐⭐⭐ | Code generation |
| **openchat** | 3.5GB | ⚡ Fast | ⭐⭐⭐ | Fast inference |

## Configuration

See `config/` directory for:

- `ollama-config.yaml` - Server and model configuration
- `.env.example` - Environment variable setup
- `docker-compose.yml` - Running Ollama in Docker

## Project Integration

### Add to Your Project

```bash
# Copy config to your project
cp -r integrations/ollama-local/config/. /your/project/.ollama/

# Copy example scripts
cp integrations/ollama-local/examples/*.py /your/project/scripts/
```

### Environment Setup

```bash
# Copy example environment file
cp integrations/ollama-local/config/.env.example .env.local

# Edit .env.local and configure:
# OLLAMA_ENDPOINT=http://localhost:11434
# OLLAMA_MODEL=mistral
# OLLAMA_KEEP_ALIVE=5m
```

### Use in Your Code

See `examples/` directory for complete implementations:

- `openai_compatible_client.py` - Drop-in replacement for OpenAI API
- `ollama_agent.py` - Claude agent using local Ollama
- `hybrid_api_client.py` - Switch between cloud and local models
- `streaming_example.py` - Streaming responses from Ollama

## Performance Tuning

### Model Parameters

```python
# Adjust for your hardware
response = client.chat.completions.create(
    model="mistral",
    messages=[...],
    temperature=0.7,      # 0.0-1.0, lower = deterministic
    top_p=0.9,            # Nucleus sampling
    top_k=40,             # Top-k sampling
    num_predict=512,      # Max tokens
    num_thread=8,         # CPU threads (match your cores)
    num_gpu=1,            # GPU layers (if available)
)
```

### Hardware Recommendations

- **CPU Only**: Mistral or smaller models
- **8GB VRAM**: Mistral 7B or Llama 2 7B
- **16GB+ VRAM**: Mixtral 8x7B or larger models
- **GPU (CUDA/Metal)**: Any model, with quantized variants for speed

## Troubleshooting

### Model Not Found
```bash
# List available models
ollama list

# Pull missing model
ollama pull mistral
```

### Connection Refused
```bash
# Check if server is running
curl http://localhost:11434/api/tags

# Start server if not running
ollama serve
```

### Slow Performance
- Use a smaller model (mistral, neural-chat)
- Enable GPU acceleration if available
- Reduce context window size
- Use quantized model versions

### Out of Memory
```bash
# Keep model in memory for shorter time
OLLAMA_KEEP_ALIVE=5m ollama serve

# Use smaller model
ollama pull mistral:7b

# Enable memory optimization
OLLAMA_NUM_PARALLEL=1 ollama serve
```

## Advanced Usage

### Docker Deployment

```bash
docker-compose -f config/docker-compose.yml up
```

### Multiple Concurrent Models

```python
import asyncio
from openai import AsyncOpenAI

client = AsyncOpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",
)

async def query_multiple(prompts):
    tasks = [
        client.chat.completions.create(
            model="mistral",
            messages=[{"role": "user", "content": p}],
        )
        for p in prompts
    ]
    return await asyncio.gather(*tasks)
```

### Custom System Prompts

```python
response = client.chat.completions.create(
    model="mistral",
    messages=[
        {
            "role": "system",
            "content": "You are an expert Python developer. Always provide clean, well-documented code."
        },
        {"role": "user", "content": "Write a function to merge two dictionaries"},
    ],
)
```

## Comparison: Cloud vs Local

| Feature | Claude API | Ollama Local |
|---------|-----------|--------------|
| Cost | Per-token | Free (hardware) |
| Privacy | Sent to Anthropic | Local only |
| Speed | Network dependent | Instant (no latency) |
| Quality | Highest tier | Good (model dependent) |
| Customization | Limited | Full control |
| Offline | No | Yes |
| Model choice | Fable/Opus/Sonnet/Haiku | 100+ open models |

## Production Considerations

For production deployments:

1. **Resource Management**
   - Monitor GPU/CPU usage
   - Set appropriate keep_alive timeouts
   - Use process managers (supervisord, systemd)

2. **High Availability**
   - Run multiple Ollama instances
   - Use load balancer (nginx)
   - Implement health checks

3. **Monitoring**
   - Track inference latency
   - Monitor model cache hits
   - Log API usage

4. **Security**
   - Restrict network access to localhost or VPN
   - Use authentication if exposed remotely
   - Monitor for resource exhaustion attacks

## References

- [Ollama Official Docs](https://github.com/ollama/ollama)
- [Model Library](https://ollama.ai/library)
- [OpenAI API Compatibility](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Performance Tuning Guide](https://github.com/ollama/ollama/wiki)

## Contributing

Found issues or have model recommendations? Submit improvements to this integration.

## License

This integration guide is part of The Agency and follows the same license terms.
