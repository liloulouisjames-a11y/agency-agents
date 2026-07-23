# 🚀 Quick Start Guide

Get local LLM inference running in 5 minutes.

## Prerequisites

- **CPU**: 4+ cores (recommended)
- **RAM**: 8GB+ (4GB minimum for smaller models)
- **Storage**: 10GB+ for models
- **Internet**: For initial setup and model download only

## Step 1: Install Ollama (2 minutes)

### macOS
```bash
brew install ollama
# or download from https://ollama.ai
```

### Linux
```bash
curl https://ollama.ai/install.sh | sh
```

### Windows
Download from https://ollama.ai/download

## Step 2: Start Ollama Server (30 seconds)

```bash
ollama serve
```

Server will start on `http://localhost:11434`

Keep this terminal open. In a new terminal, continue to step 3.

## Step 3: Pull a Model (5-15 minutes)

In a new terminal:

```bash
# Fast model (recommended for first run)
ollama pull mistral

# Alternative: Conversational model
# ollama pull neural-chat
```

Wait for download to complete (~4GB).

## Step 4: Test It (30 seconds)

### Option A: Using curl
```bash
curl http://localhost:11434/api/generate -d '{
  "model": "mistral",
  "prompt": "Why is the sky blue?",
  "stream": false
}'
```

### Option B: Using Python
```bash
pip install openai
```

Create `test.py`:
```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")
response = client.chat.completions.create(
    model="mistral",
    messages=[{"role": "user", "content": "Why is the sky blue?"}]
)
print(response.choices[0].message.content)
```

```bash
python test.py
```

## Step 5: Use in Your Project (1 minute)

### Python Integration

```python
from openai import OpenAI

# Just like Claude API, but local!
client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",  # not used, but required by SDK
)

response = client.chat.completions.create(
    model="mistral",
    messages=[
        {"role": "system", "content": "You are helpful."},
        {"role": "user", "content": "Write a Python function to check if a number is prime."},
    ],
)

print(response.choices[0].message.content)
```

## Common Models

| Model | Size | Speed | Quality | Use |
|-------|------|-------|---------|-----|
| **mistral** | 4.1GB | ⚡⚡⚡ | ⭐⭐⭐⭐ | General (START HERE) |
| neural-chat | 3.8GB | ⚡⚡⚡ | ⭐⭐⭐⭐ | Chat/Conversation |
| codellama | 3.8GB | ⚡⚡⚡ | ⭐⭐⭐⭐ | Code Generation |
| dolphin-mixtral | 26GB | 🚀 | ⭐⭐⭐⭐⭐ | Advanced (needs GPU) |

## Pull Multiple Models

```bash
ollama pull mistral
ollama pull neural-chat
ollama pull codellama
```

Then switch models in your code:
```python
response = client.chat.completions.create(
    model="neural-chat",  # change model
    messages=[...],
)
```

## Troubleshooting

### Server won't start
```bash
# Check if port 11434 is in use
lsof -i :11434

# Kill existing process
killall ollama

# Start fresh
ollama serve
```

### Out of memory
```bash
# Limit parallel requests
export OLLAMA_NUM_PARALLEL=1
ollama serve
```

### Slow performance
- Use `mistral` or smaller model
- Enable GPU if available
- Increase keep_alive timeout:
  ```bash
  export OLLAMA_KEEP_ALIVE=30m
  ollama serve
  ```

### Model not found
```bash
# List available models
ollama list

# Pull missing model
ollama pull mistral
```

## Next Steps

1. **Explore Examples**: See `examples/` directory
2. **Read Full Guide**: See `README.md`
3. **Setup Automation**: Run `./scripts/setup.sh`
4. **Production Deploy**: See Docker setup in `config/docker-compose.yml`

## Performance Tips

### CPU Optimization
```bash
# Set threads to match your cores (e.g., 8-core CPU)
export OLLAMA_NUM_THREAD=8
ollama serve
```

### GPU Acceleration (if available)
```bash
# CUDA (NVIDIA)
export OLLAMA_GPU_LAYERS=30

# Metal (macOS M1/M2)
# Automatic, no config needed
```

### Memory Efficiency
```bash
# Keep model in memory for 5 minutes of inactivity
export OLLAMA_KEEP_ALIVE=5m
ollama serve

# Reduce to 1 minute for low-memory systems
export OLLAMA_KEEP_ALIVE=1m
ollama serve
```

## API Endpoints

- **Chat Completions** (OpenAI compatible):
  ```
  POST http://localhost:11434/v1/chat/completions
  ```

- **Raw Generation** (Ollama native):
  ```
  POST http://localhost:11434/api/generate
  ```

- **Model List**:
  ```
  GET http://localhost:11434/api/tags
  ```

## Stop Server

```bash
# Gracefully (Ctrl+C in server terminal)

# Or from another terminal
killall ollama
```

## System Requirements by Model

### Mistral (Recommended)
- **CPU**: 4+ cores ✅
- **RAM**: 8GB+ ✅
- **VRAM**: None needed
- **Speed**: ~5-10 tokens/sec

### Neural Chat
- **CPU**: 4+ cores ✅
- **RAM**: 8GB+ ✅
- **VRAM**: None needed
- **Speed**: ~8-12 tokens/sec

### Dolphin Mixtral (Advanced)
- **CPU**: 8+ cores
- **RAM**: 32GB+ (with GPU: 16GB)
- **VRAM**: 24GB+ NVIDIA/AMD
- **Speed**: With GPU ~20-40 tokens/sec

## Cost Comparison

| Service | Cost | Privacy | Speed | Offline |
|---------|------|---------|-------|---------|
| Claude API | ~$0.003-0.03/1K tokens | Sent to Anthropic | Network dependent | ❌ |
| Ollama Local | Free (hardware) | Local only | Instant | ✅ |

## Additional Resources

- **Ollama Docs**: https://github.com/ollama/ollama
- **Model Library**: https://ollama.ai/library
- **OpenAI API Docs**: https://platform.openai.com/docs

## Get Help

If something doesn't work:

1. Check `ollama serve` terminal for errors
2. Verify server with: `curl http://localhost:11434/api/tags`
3. Try restarting Ollama
4. Check available disk space: `df -h`
5. Free up RAM: Close other applications

---

**That's it! You now have a local LLM running.** 🎉

Start with the `openai_compatible_client.py` example to see it in action.
