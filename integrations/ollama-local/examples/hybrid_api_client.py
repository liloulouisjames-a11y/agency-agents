#!/usr/bin/env python3
"""
Hybrid client: switch between Claude API and Ollama.

Enables seamless switching between cloud (Claude) and local (Ollama)
inference for cost optimization and offline capability.

Usage:
    python hybrid_api_client.py --model local
    python hybrid_api_client.py --model claude
"""

import os
from typing import Literal
from enum import Enum

try:
    from openai import OpenAI, Anthropic
except ImportError:
    raise ImportError("Install required packages: pip install openai anthropic")


class ModelProvider(Enum):
    """Available model providers."""

    OLLAMA = "ollama"
    CLAUDE = "claude"


class HybridLLMClient:
    """Unified interface for multiple LLM providers."""

    def __init__(
        self,
        provider: ModelProvider = ModelProvider.OLLAMA,
        ollama_url: str = "http://localhost:11434/v1",
        ollama_model: str = "mistral",
        claude_model: str = "claude-opus-4-1",
        claude_api_key: str = "",
    ):
        """Initialize hybrid client.

        Args:
            provider: Primary provider to use (OLLAMA or CLAUDE)
            ollama_url: Ollama server URL
            ollama_model: Model name for Ollama
            claude_model: Model name for Claude API
            claude_api_key: Claude API key (uses ANTHROPIC_API_KEY if empty)
        """
        self.provider = provider
        self.ollama_model = ollama_model
        self.claude_model = claude_model

        # Initialize Ollama client
        self.ollama_client = OpenAI(
            base_url=ollama_url,
            api_key="ollama",  # dummy key, not used
            timeout=300.0,
        )

        # Initialize Claude client
        api_key = claude_api_key or os.getenv("ANTHROPIC_API_KEY", "")
        self.claude_client = Anthropic(api_key=api_key)

    def switch_provider(self, provider: ModelProvider) -> None:
        """Switch to a different provider."""
        self.provider = provider

    def is_ollama_available(self) -> bool:
        """Check if Ollama server is reachable."""
        try:
            self.ollama_client.models.list()
            return True
        except Exception:
            return False

    def complete(
        self,
        prompt: str,
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 512,
    ) -> str:
        """Get completion from configured provider.

        Falls back to alternative provider if primary is unavailable.
        """
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            if self.provider == ModelProvider.OLLAMA:
                return self._complete_ollama(messages, temperature, max_tokens)
            else:
                return self._complete_claude(messages, temperature, max_tokens)
        except Exception as e:
            print(f"⚠️  {self.provider.value} failed: {e}")
            print(f"📍 Falling back to {self._alternate_provider().value}...")

            # Try alternate provider
            original_provider = self.provider
            self.provider = self._alternate_provider()
            try:
                return self.complete(prompt, system_prompt, temperature, max_tokens)
            except Exception as fallback_error:
                self.provider = original_provider
                raise RuntimeError(
                    f"Both providers failed. "
                    f"Original: {e}. Fallback: {fallback_error}"
                )

    def _complete_ollama(
        self, messages: list, temperature: float, max_tokens: int
    ) -> str:
        """Get completion from Ollama."""
        response = self.ollama_client.chat.completions.create(
            model=self.ollama_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content

    def _complete_claude(
        self, messages: list, temperature: float, max_tokens: int
    ) -> str:
        """Get completion from Claude API."""
        response = self.claude_client.messages.create(
            model=self.claude_model,
            max_tokens=max_tokens,
            temperature=temperature,
            system=next(
                (m["content"] for m in messages if m["role"] == "system"), ""
            ),
            messages=[
                m for m in messages if m["role"] in ("user", "assistant")
            ],
        )
        return response.content[0].text

    def _alternate_provider(self) -> ModelProvider:
        """Get the alternate provider."""
        return (
            ModelProvider.CLAUDE
            if self.provider == ModelProvider.OLLAMA
            else ModelProvider.OLLAMA
        )

    def get_provider_info(self) -> dict:
        """Get info about current provider."""
        return {
            "provider": self.provider.value,
            "model": (
                self.ollama_model
                if self.provider == ModelProvider.OLLAMA
                else self.claude_model
            ),
            "status": (
                "✅ Available"
                if (
                    self.provider == ModelProvider.OLLAMA
                    and self.is_ollama_available()
                )
                else "✅ Available"
            ),
        }


def main():
    """Run hybrid client examples."""
    print("🔄 Hybrid LLM Client Example\n")

    # Create hybrid client
    client = HybridLLMClient(provider=ModelProvider.OLLAMA)

    # Check providers
    print("Provider Status:")
    print(f"  Ollama: {'✅ Available' if client.is_ollama_available() else '❌ Offline'}")
    print(f"  Claude: {'✅ Available' if os.getenv('ANTHROPIC_API_KEY') else '❌ No API key'}")
    print()

    # Example 1: Use Ollama
    print("=" * 50)
    print("Example 1: Using Ollama")
    print("=" * 50)
    client.switch_provider(ModelProvider.OLLAMA)
    info = client.get_provider_info()
    print(f"Provider: {info['provider']} ({info['model']})")

    response = client.complete(
        "What is 2+2?",
        system_prompt="Be concise.",
    )
    print(f"Response: {response}\n")

    # Example 2: Use Claude API (if available)
    if os.getenv("ANTHROPIC_API_KEY"):
        print("=" * 50)
        print("Example 2: Using Claude API")
        print("=" * 50)
        client.switch_provider(ModelProvider.CLAUDE)
        info = client.get_provider_info()
        print(f"Provider: {info['provider']} ({info['model']})")

        response = client.complete(
            "What is 2+2?",
            system_prompt="Be concise.",
        )
        print(f"Response: {response}\n")

    # Example 3: Automatic fallback
    print("=" * 50)
    print("Example 3: Automatic Provider Fallback")
    print("=" * 50)
    print("If primary provider fails, system automatically switches.")

    # Force to unavailable provider and let it fallback
    client.switch_provider(ModelProvider.CLAUDE)  # Will fallback if no API key

    response = client.complete("Explain quantum computing briefly")
    print(f"Response: {response}\n")

    # Example 4: Batch processing
    print("=" * 50)
    print("Example 4: Batch Processing")
    print("=" * 50)
    prompts = [
        "Write a haiku about programming",
        "What is the meaning of life?",
        "Explain photosynthesis briefly",
    ]

    for i, prompt in enumerate(prompts, 1):
        print(f"\n[{i}] {prompt}")
        response = client.complete(prompt, temperature=0.8, max_tokens=100)
        print(f"    {response}")


if __name__ == "__main__":
    main()
