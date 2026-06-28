#!/usr/bin/env python3
"""
Streaming responses from Ollama.

Demonstrates real-time streaming of generated tokens
for immediate feedback and reduced perceived latency.

Usage:
    python streaming_example.py
"""

import time
from openai import OpenAI


def stream_chat(
    prompt: str,
    model: str = "mistral",
    system_prompt: str = "",
    temperature: float = 0.7,
) -> str:
    """Stream a chat completion, printing tokens as they arrive."""
    client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    print("▶ Streaming response:\n", end="")

    full_response = ""
    start_time = time.time()
    token_count = 0

    with client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=temperature,
        stream=True,
    ) as stream:
        for text in stream.text_stream:
            print(text, end="", flush=True)
            full_response += text
            token_count += len(text.split())

    elapsed = time.time() - start_time
    tokens_per_second = token_count / elapsed if elapsed > 0 else 0

    print(f"\n\n⏱️  Time: {elapsed:.1f}s | Tokens: {token_count} | Speed: {tokens_per_second:.1f} tok/s\n")

    return full_response


def batch_streaming(prompts: list[str], model: str = "mistral") -> list[str]:
    """Process multiple prompts with streaming."""
    results = []
    for i, prompt in enumerate(prompts, 1):
        print(f"[{i}/{len(prompts)}] {prompt}")
        response = stream_chat(prompt, model=model)
        results.append(response)
        print("-" * 50)
    return results


def interactive_streaming(model: str = "mistral") -> None:
    """Interactive streaming chat loop."""
    print("🦙 Ollama Streaming Chat (type 'quit' to exit)\n")

    client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")
    messages = []

    while True:
        prompt = input("\nYou: ").strip()
        if prompt.lower() == "quit":
            break

        messages.append({"role": "user", "content": prompt})

        print("Agent: ", end="")
        full_response = ""

        with client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
        ) as stream:
            for text in stream.text_stream:
                print(text, end="", flush=True)
                full_response += text

        messages.append({"role": "assistant", "content": full_response})
        print()


def benchmark_streaming_vs_nonstreaming(
    prompt: str = "Write a detailed explanation of how neural networks work",
    model: str = "mistral",
) -> None:
    """Compare streaming vs non-streaming performance."""
    client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")

    messages = [{"role": "user", "content": prompt}]

    print("📊 Streaming vs Non-Streaming Benchmark\n")
    print(f"Prompt: {prompt[:50]}...\n")

    # Non-streaming
    print("Non-streaming (waiting for complete response):")
    start = time.time()
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        stream=False,
    )
    nonstream_time = time.time() - start
    print(f"Time: {nonstream_time:.2f}s\n")

    # Streaming
    print("Streaming (tokens appear as generated):")
    print("Response: ", end="")
    start = time.time()
    with client.chat.completions.create(
        model=model,
        messages=messages,
        stream=True,
    ) as stream:
        for text in stream.text_stream:
            print(text, end="", flush=True)
    stream_time = time.time() - start
    print(f"\n\nTime: {stream_time:.2f}s\n")

    print(f"Results:")
    print(f"  Non-streaming: {nonstream_time:.2f}s (wait time)")
    print(f"  Streaming: {stream_time:.2f}s (user sees response immediately)")
    print(f"  Perceived UX improvement: Streaming shows first token in ~1s")


def progressive_refinement(
    initial_prompt: str = "Write a haiku",
    refinements: list[str] = None,
    model: str = "mistral",
) -> None:
    """Demonstrate progressive refinement with streaming."""
    if refinements is None:
        refinements = [
            "Make it about winter",
            "Make it about technology",
            "Make it melancholic",
        ]

    client = OpenAI(base_url="http://localhost:11434/v1", api_key="ollama")

    print("🔄 Progressive Refinement with Streaming\n")

    messages = [{"role": "user", "content": initial_prompt}]

    # Initial response
    print(f"Initial: {initial_prompt}")
    print("Response: ", end="")
    with client.chat.completions.create(
        model=model,
        messages=messages,
        stream=True,
    ) as stream:
        initial_response = ""
        for text in stream.text_stream:
            print(text, end="", flush=True)
            initial_response += text

    messages.append({"role": "assistant", "content": initial_response})
    print("\n")

    # Refinements
    for i, refinement in enumerate(refinements, 1):
        print(f"Refinement {i}: {refinement}")
        messages.append({"role": "user", "content": refinement})

        print("Response: ", end="")
        with client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
        ) as stream:
            refined_response = ""
            for text in stream.text_stream:
                print(text, end="", flush=True)
                refined_response += text

        messages.append({"role": "assistant", "content": refined_response})
        print("\n")


def main():
    """Run streaming examples."""
    print("🌊 Ollama Streaming Examples\n")

    # Example 1: Simple streaming
    print("=" * 50)
    print("Example 1: Simple Streaming")
    print("=" * 50)
    stream_chat("Explain quantum computing in one paragraph")
    print()

    # Example 2: Batch streaming
    print("=" * 50)
    print("Example 2: Batch Streaming")
    print("=" * 50)
    prompts = [
        "What is photosynthesis?",
        "How do bees navigate?",
        "Explain DNS servers",
    ]
    batch_streaming(prompts)
    print()

    # Example 3: Streaming vs non-streaming benchmark
    print("=" * 50)
    print("Example 3: Performance Comparison")
    print("=" * 50)
    benchmark_streaming_vs_nonstreaming()
    print()

    # Example 4: Progressive refinement
    print("=" * 50)
    print("Example 4: Progressive Refinement")
    print("=" * 50)
    progressive_refinement()

    # Example 5: Interactive mode (uncomment to enable)
    # print("\n" + "=" * 50)
    # print("Example 5: Interactive Streaming Chat")
    # print("=" * 50)
    # interactive_streaming()


if __name__ == "__main__":
    main()
