#!/usr/bin/env python3
"""
OpenAI-compatible Ollama client.

This example shows how to use Ollama with the OpenAI SDK,
enabling drop-in replacement for existing Claude API code.

Usage:
    python openai_compatible_client.py
"""

import os
from typing import Optional
from openai import OpenAI, APIError, APIConnectionError

# Initialize Ollama client with OpenAI API compatibility layer
def create_ollama_client(
    base_url: str = "http://localhost:11434/v1",
    api_key: str = "ollama",
    timeout: float = 300.0,
) -> OpenAI:
    """Create OpenAI-compatible Ollama client."""
    return OpenAI(
        base_url=base_url,
        api_key=api_key,
        timeout=timeout,
    )


def chat_completion(
    client: OpenAI,
    prompt: str,
    model: str = "mistral",
    system_prompt: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 512,
) -> str:
    """Get a chat completion from Ollama."""
    messages = []

    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})

    messages.append({"role": "user", "content": prompt})

    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content
    except APIConnectionError as e:
        raise RuntimeError(
            f"Failed to connect to Ollama at {client.base_url}. "
            "Is the Ollama server running? Start with: ollama serve"
        ) from e
    except APIError as e:
        raise RuntimeError(f"Ollama API error: {e}") from e


def streaming_completion(
    client: OpenAI,
    prompt: str,
    model: str = "mistral",
    system_prompt: Optional[str] = None,
) -> None:
    """Stream responses from Ollama (print token by token)."""
    messages = []

    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})

    messages.append({"role": "user", "content": prompt})

    with client.chat.completions.create(
        model=model,
        messages=messages,
        stream=True,
    ) as stream:
        for text in stream.text_stream:
            print(text, end="", flush=True)
    print()  # Newline after streaming


def list_available_models(client: OpenAI) -> list[str]:
    """List available models on the Ollama server."""
    try:
        response = client.models.list()
        return [model.id for model in response.data]
    except Exception as e:
        print(f"Failed to list models: {e}")
        return []


def main():
    """Run example demonstrations."""
    # Create client
    client = create_ollama_client()

    print("🦙 Ollama + OpenAI SDK Example\n")

    # Check available models
    print("Available models:")
    models = list_available_models(client)
    if models:
        for model in models:
            print(f"  - {model}")
    else:
        print("  No models found. Pull one with: ollama pull mistral")
        return

    model = models[0] if models else "mistral"
    print(f"\nUsing model: {model}\n")

    # Example 1: Simple completion
    print("=" * 50)
    print("Example 1: Simple Completion")
    print("=" * 50)
    prompt = "What is the capital of France?"
    response = chat_completion(client, prompt, model=model)
    print(f"Q: {prompt}")
    print(f"A: {response}\n")

    # Example 2: With system prompt
    print("=" * 50)
    print("Example 2: With System Prompt")
    print("=" * 50)
    system = "You are a helpful Python developer. Provide concise, practical answers."
    prompt = "Write a one-liner Python function to check if a number is even"
    response = chat_completion(
        client,
        prompt,
        model=model,
        system_prompt=system,
        temperature=0.2,
    )
    print(f"System: {system}")
    print(f"Q: {prompt}")
    print(f"A: {response}\n")

    # Example 3: Streaming response
    print("=" * 50)
    print("Example 3: Streaming Response")
    print("=" * 50)
    prompt = "Explain machine learning in 3 sentences"
    print(f"Q: {prompt}")
    print("A: ", end="")
    streaming_completion(client, prompt, model=model)
    print()

    # Example 4: Temperature control
    print("=" * 50)
    print("Example 4: Temperature Control")
    print("=" * 50)
    prompt = "Complete this: The future of AI is..."
    print(f"Prompt: {prompt}\n")

    for temp in [0.2, 0.7, 1.0]:
        response = chat_completion(
            client,
            prompt,
            model=model,
            temperature=temp,
            max_tokens=50,
        )
        print(f"Temperature {temp}: {response}")


if __name__ == "__main__":
    main()
