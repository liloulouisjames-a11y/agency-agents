#!/usr/bin/env python3
"""
Claude-like agent using Ollama.

Demonstrates building a stateful agent with context management,
function calling patterns, and multi-turn conversations.

Usage:
    python ollama_agent.py
"""

import json
from typing import Optional
from dataclasses import dataclass
from openai import OpenAI


@dataclass
class Message:
    """Represents a single message in conversation."""

    role: str
    content: str


class OllamaAgent:
    """Stateful agent using local Ollama model."""

    def __init__(
        self,
        model: str = "mistral",
        system_prompt: str = "",
        base_url: str = "http://localhost:11434/v1",
    ):
        """Initialize agent.

        Args:
            model: Model name to use
            system_prompt: System instructions for the agent
            base_url: Ollama server base URL
        """
        self.model = model
        self.system_prompt = system_prompt
        self.client = OpenAI(base_url=base_url, api_key="ollama")
        self.conversation_history: list[Message] = []

    def think(self, user_input: str, temperature: float = 0.7) -> str:
        """Process user input and generate response.

        Maintains conversation history for context.
        """
        # Add user message to history
        self.conversation_history.append(Message("user", user_input))

        # Prepare messages for API
        messages = []
        if self.system_prompt:
            messages.append({"role": "system", "content": self.system_prompt})

        for msg in self.conversation_history:
            messages.append({"role": msg.role, "content": msg.content})

        # Get response from model
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
        )

        assistant_message = response.choices[0].message.content

        # Add assistant response to history
        self.conversation_history.append(Message("assistant", assistant_message))

        return assistant_message

    def think_with_context(
        self,
        user_input: str,
        additional_context: str = "",
        temperature: float = 0.7,
    ) -> str:
        """Think with additional context provided inline."""
        context_prompt = (
            f"Additional context:\n{additional_context}\n\nUser query: {user_input}"
        )
        return self.think(context_prompt, temperature)

    def stream_response(self, user_input: str) -> None:
        """Stream response token by token."""
        self.conversation_history.append(Message("user", user_input))

        messages = []
        if self.system_prompt:
            messages.append({"role": "system", "content": self.system_prompt})

        for msg in self.conversation_history:
            messages.append({"role": msg.role, "content": msg.content})

        with self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            stream=True,
        ) as stream:
            full_response = ""
            for text in stream.text_stream:
                print(text, end="", flush=True)
                full_response += text
            print()

        self.conversation_history.append(Message("assistant", full_response))

    def clear_history(self) -> None:
        """Clear conversation history."""
        self.conversation_history = []

    def get_history(self) -> list[dict]:
        """Get conversation history as JSON."""
        return [
            {"role": msg.role, "content": msg.content}
            for msg in self.conversation_history
        ]

    def save_conversation(self, filepath: str) -> None:
        """Save conversation to JSON file."""
        with open(filepath, "w") as f:
            json.dump(self.get_history(), f, indent=2)

    def load_conversation(self, filepath: str) -> None:
        """Load conversation from JSON file."""
        with open(filepath) as f:
            history = json.load(f)
            self.conversation_history = [
                Message(msg["role"], msg["content"]) for msg in history
            ]


def create_specialized_agents() -> dict:
    """Create specialized agents for different tasks."""
    return {
        "coder": OllamaAgent(
            model="codellama",
            system_prompt="""You are an expert Python programmer.
            Provide clear, well-commented code examples.
            Always explain your approach.""",
        ),
        "writer": OllamaAgent(
            model="mistral",
            system_prompt="""You are a skilled technical writer.
            Explain complex topics in clear, accessible language.
            Use analogies and examples.""",
        ),
        "analyst": OllamaAgent(
            model="mistral",
            system_prompt="""You are a data analyst and critical thinker.
            Break down problems systematically.
            Consider multiple perspectives.""",
        ),
    }


def multi_turn_conversation():
    """Demonstrate multi-turn conversation with context."""
    print("🤖 Ollama Agent - Multi-turn Conversation Example\n")

    agent = OllamaAgent(
        system_prompt="You are a helpful assistant. Keep responses concise and friendly.",
    )

    # Simulate a conversation
    exchanges = [
        "What is the capital of France?",
        "Tell me about its history.",
        "What's the population?",
    ]

    for i, prompt in enumerate(exchanges, 1):
        print(f"\n[{i}] User: {prompt}")
        response = agent.think(prompt, temperature=0.7)
        print(f"    Agent: {response}")

    print("\n\nConversation History:")
    for msg in agent.get_history():
        print(f"  {msg['role'].upper()}: {msg['content'][:50]}...")


def specialized_agents_demo():
    """Demonstrate specialized agents."""
    print("\n🎯 Specialized Agents Example\n")

    agents = create_specialized_agents()

    # Coder agent
    print("=" * 50)
    print("Coder Agent")
    print("=" * 50)
    response = agents["coder"].think(
        "Write a function to compute fibonacci numbers"
    )
    print(response)

    # Writer agent
    print("\n" + "=" * 50)
    print("Writer Agent")
    print("=" * 50)
    response = agents["writer"].think("Explain machine learning for beginners")
    print(response)

    # Analyst agent
    print("\n" + "=" * 50)
    print("Analyst Agent")
    print("=" * 50)
    response = agents["analyst"].think(
        "What are the pros and cons of remote work?"
    )
    print(response)


def rag_pattern_demo():
    """Demonstrate RAG (Retrieval-Augmented Generation) pattern."""
    print("\n📚 RAG (Context-Augmented) Pattern Example\n")

    agent = OllamaAgent(
        system_prompt="You are an expert in the provided context.",
    )

    # Simulate retrieving context from a knowledge base
    context = """
    Python is a high-level programming language known for:
    - Clear, readable syntax
    - Extensive standard library
    - Strong community support
    - Applications in web, data science, AI, and automation
    - The Zen of Python emphasizes simplicity and readability
    """

    query = "Why is Python popular for data science?"

    print(f"Context: {context.strip()}\n")
    print(f"Query: {query}\n")

    response = agent.think_with_context(query, context)
    print(f"Response: {response}")


def main():
    """Run all examples."""
    try:
        # Multi-turn conversation
        multi_turn_conversation()

        # Specialized agents
        specialized_agents_demo()

        # RAG pattern
        rag_pattern_demo()

    except KeyboardInterrupt:
        print("\n\nExiting...")


if __name__ == "__main__":
    main()
