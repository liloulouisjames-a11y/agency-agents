# The `openclaw` Ollama model

A reproducible local model so your agents are **truly free** — no API, no cloud.
The OpenClaw gateway drives it with `ollama run openclaw` (message on stdin).

## Build

```bash
# 1. Install Ollama → https://ollama.com  (works on WSL/Linux/macOS/Windows)
# 2. Pull a base model (change this in the Modelfile to taste)
ollama pull llama3.1:8b
# 3. Create the openclaw model from the Modelfile
cd openclaw/ollama
ollama create openclaw -f Modelfile
# 4. Test it
echo "say hi in 5 words" | ollama run openclaw
```

Or use the helper:

```bash
./scripts/build-ollama-model.sh           # builds "openclaw" from ollama/Modelfile
./scripts/build-ollama-model.sh qwen2.5   # use a different base model
```

## Wire it to the gateway

In `openclaw/.env`:

```env
OPENCLAW_BACKEND=ollama
OPENCLAW_OLLAMA_MODEL=openclaw
# optional: warm up the server when the gateway opens
OPENCLAW_LAUNCH_CMD=ollama serve
```

## Choosing a base model

| Base | Notes |
|---|---|
| `llama3.1:8b` | Good general default; solid reasoning, runs on ~8GB+ RAM/VRAM. |
| `qwen2.5:7b` | Strong all-rounder, good at code and multilingual (incl. Chinese). |
| `mistral` / `phi3` | Lighter/faster on modest hardware. |
| `llama3.1:70b` | Much stronger, needs a big GPU. |

The persona of whichever Agency specialist you pick (`/use frontend`) is
prepended to each message, so even a small base model takes on that role.
