# Ollama Integration Guide

Complete guide to integrating Ollama into your projects.

## Table of Contents

1. [For Individual Developers](#for-individual-developers)
2. [For Project Teams](#for-project-teams)
3. [For Production Deployments](#for-production-deployments)
4. [Comparison: Cloud vs Local](#comparison-cloud-vs-local)

---

## For Individual Developers

### Setup (One-time)

```bash
# 1. Follow QUICKSTART.md
# 2. Then copy integration files to your project:

cp -r config .ollama/
cp -r examples scripts/
cp requirements.txt .

# 3. Create environment
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Usage in Your Code

Replace any Claude API calls with Ollama:

**Before (Claude API):**
```python
from anthropic import Anthropic

client = Anthropic(api_key="sk-ant-...")
response = client.messages.create(
    model="claude-opus-4-1",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}],
)
```

**After (Ollama Local):**
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",
)
response = client.chat.completions.create(
    model="mistral",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}],
)
```

### Development Workflow

1. **Start server**: `ollama serve`
2. **Develop locally**: Run your code against local model
3. **Test quality**: Compare outputs with cloud model if needed
4. **Deploy**: Choose cloud or keep local based on requirements

---

## For Project Teams

### Team Setup

```bash
# Project maintainer: Add to repo
git clone <repo>
cp -r integrations/ollama-local .ollama-config/

# Team members: One-time setup
cd <project>
./scripts/install-ollama.sh  # Auto-detects OS
source venv/bin/activate
```

### Shared Configuration

**`.ollama-config/team-config.yaml`:**
```yaml
# All team members use same model/settings
team:
  default_model: mistral
  temperature: 0.7
  max_context: 4096

  # Different models for different tasks
  tasks:
    coding: codellama
    analysis: mistral
    chat: neural-chat
```

**Code with configuration:**
```python
import yaml
from openai import OpenAI

# Load team config
with open(".ollama-config/team-config.yaml") as f:
    config = yaml.safe_load(f)

client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",
)

# Use team default
response = client.chat.completions.create(
    model=config["team"]["default_model"],
    messages=[...],
    temperature=config["team"]["temperature"],
)
```

### Hybrid Team (Cloud + Local)

```python
from hybrid_api_client import HybridLLMClient, ModelProvider

# Developers use local by default
# But can switch to cloud for production validation
client = HybridLLMClient(
    provider=ModelProvider.OLLAMA,
    fallback=ModelProvider.CLAUDE,  # If local unavailable
)

response = client.complete("Your prompt")
```

### CI/CD Integration

**`.github/workflows/test.yml`:**
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Ollama
        run: |
          curl https://ollama.ai/install.sh | sh
          ollama pull mistral &
          sleep 30
      
      - name: Run Tests
        run: |
          python -m pytest tests/
        env:
          OLLAMA_MODEL: mistral
```

---

## For Production Deployments

### Docker Deployment

**Simple deployment:**
```bash
docker-compose -f config/docker-compose.yml up -d

# Verify
curl http://localhost:11434/api/tags
```

### Kubernetes Deployment

**`k8s/ollama-deployment.yaml`:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ollama-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ollama
  template:
    metadata:
      labels:
        app: ollama
    spec:
      containers:
      - name: ollama
        image: ollama/ollama:latest
        ports:
        - containerPort: 11434
        resources:
          requests:
            memory: "8Gi"
            cpu: "4"
          limits:
            memory: "16Gi"
            cpu: "8"
        volumeMounts:
        - name: models
          mountPath: /root/.ollama
      volumes:
      - name: models
        persistentVolumeClaim:
          claimName: ollama-models

---
apiVersion: v1
kind: Service
metadata:
  name: ollama-service
spec:
  selector:
    app: ollama
  ports:
  - protocol: TCP
    port: 11434
    targetPort: 11434
  type: ClusterIP
```

Deploy:
```bash
kubectl apply -f k8s/ollama-deployment.yaml
kubectl port-forward svc/ollama-service 11434:11434
```

### High Availability Setup

**Load-balanced Ollama cluster:**
```yaml
# Run multiple Ollama instances
docker-compose -f config/docker-compose-multi.yml up

# With nginx load balancer
upstream ollama {
    server ollama-1:11434;
    server ollama-2:11434;
    server ollama-3:11434;
}

server {
    listen 11434;
    
    location / {
        proxy_pass http://ollama;
    }
}
```

### Monitoring

**Prometheus metrics export:**
```python
from prometheus_client import Counter, Histogram, start_http_server
import time

# Start metrics server
start_http_server(8000)

request_count = Counter('ollama_requests_total', 'Total requests')
request_duration = Histogram('ollama_request_duration_seconds', 'Request duration')

def monitored_complete(prompt):
    request_count.inc()
    
    with request_duration.time():
        response = client.chat.completions.create(
            model="mistral",
            messages=[{"role": "user", "content": prompt}],
        )
    
    return response.choices[0].message.content
```

### Security

**Access control:**
```python
from fastapi import FastAPI, HTTPException, Header
from typing import Optional

app = FastAPI()

API_KEY = "your-secure-api-key"

@app.post("/complete")
async def complete(
    prompt: str,
    authorization: Optional[str] = Header(None),
):
    if not authorization or authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    response = client.chat.completions.create(
        model="mistral",
        messages=[{"role": "user", "content": prompt}],
    )
    
    return {"response": response.choices[0].message.content}
```

**Firewall rules:**
```bash
# Linux: Allow only local access
sudo ufw default deny incoming
sudo ufw allow from localhost to localhost port 11434

# Or restrict to specific IP range (VPN)
sudo ufw allow from 10.0.0.0/8 to any port 11434
```

---

## Comparison: Cloud vs Local

### Use Cloud (Claude API) When:
- ✅ Need highest quality/latest models
- ✅ Require advanced capabilities (vision, tool use, etc.)
- ✅ Don't have local compute resources
- ✅ Need guaranteed uptime/SLA
- ✅ Data residency is not a concern

### Use Local (Ollama) When:
- ✅ Privacy/data residency required
- ✅ Need offline capability
- ✅ Want to minimize API costs at scale
- ✅ Can allocate local compute
- ✅ Building during development (free)

### Hybrid Approach (Recommended):
```python
# Development: Use local Ollama
# Testing: Use both, compare outputs
# Production: Choose based on requirements

class SmartClient:
    def __init__(self):
        self.local = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")
        self.cloud = Anthropic(api_key="sk-ant-...")
    
    def complete(self, prompt, quality="balanced"):
        if quality == "low":
            return self.local.chat.completions.create(...)
        elif quality == "high":
            return self.cloud.messages.create(...)
        else:
            # Balanced: Try local first, fallback to cloud
            try:
                return self.local.chat.completions.create(...)
            except:
                return self.cloud.messages.create(...)
```

---

## Performance Benchmarks

### Latency (Time to First Token)
| Model | CPU | GPU |
|-------|-----|-----|
| Mistral | 2-3s | 0.5s |
| Neural Chat | 2-3s | 0.5s |
| Dolphin Mixtral | 5-10s | 1-2s |

### Throughput (Tokens/Second)
| Model | CPU | GPU |
|-------|-----|-----|
| Mistral | 5-10 | 20-30 |
| Neural Chat | 8-12 | 25-40 |
| Dolphin Mixtral | 2-5 | 30-50 |

### Cost Per Million Tokens
| Service | Cost |
|---------|------|
| Claude Opus | ~$15 |
| Claude Sonnet | ~$3 |
| Ollama Local | ~$0 (hardware amortized) |

---

## Troubleshooting Production Issues

### High Latency
```bash
# Enable GPU acceleration
export OLLAMA_NUM_GPU=1

# Increase cache timeout
export OLLAMA_KEEP_ALIVE=30m

# Monitor with
curl -s http://localhost:11434/api/ps
```

### Out of Memory
```bash
# Reduce parallel requests
export OLLAMA_NUM_PARALLEL=1

# Switch to smaller model
# Or increase system RAM/add swap
```

### Connection Refused
```bash
# Check server status
curl http://localhost:11434/api/tags

# Check listening ports
netstat -tlnp | grep 11434

# Verify firewall
sudo ufw show added
```

---

## Migration Guide

### From Claude API to Ollama

```python
# Step 1: Update imports
# from anthropic import Anthropic
from openai import OpenAI

# Step 2: Update client initialization
# client = Anthropic(api_key="sk-ant-...")
client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama",
)

# Step 3: Update model name
# model="claude-opus-4-1"
model="mistral"

# Step 4: Update message format (same format, mostly!)
response = client.chat.completions.create(
    model=model,
    messages=[
        {"role": "user", "content": "Hello"},
    ],
)

# Step 5: Update response parsing
text = response.choices[0].message.content  # Same format!
```

---

## Next Steps

1. **Read QUICKSTART.md** - Get running in 5 minutes
2. **Review examples/** - See practical implementations
3. **Setup.sh** - Automate team onboarding
4. **Deploy** - Choose cloud, local, or hybrid approach

Happy local inferencing! 🦙
