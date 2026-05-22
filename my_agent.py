import os
import asyncio
from kani import Kani, ai_function, chat_in_terminal
from kani.engines.openai import OpenAIEngine
from openai import AsyncOpenAI

# 1. Setup the Local Connection
client = AsyncOpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama"
)

engine = OpenAIEngine(
    client=client,
    model="llama3.2", 
    api_type="chat_completions",
    max_context_size=4096
)

# 2. The Agent with Read, Tail, and Write tools
class RepoAgent(Kani):
    @ai_function
    def list_files(self):
        """Lists all files in the current workspace."""
        files = os.listdir('.')
        return f"Files in directory: {', '.join(files)}"

    @ai_function
    def read_repo_file(self, file_path: str):
        """Reads a full file. (Warning: Don't use on files over 500 lines)"""
        try:
            with open(file_path, "r") as f:
                return f.read()
        except Exception as e:
            return f"Error reading file: {str(e)}"

    @ai_function
    def read_file_tail(self, file_path: str, lines: int = 50):
        """Reads the last few lines of a file. Use this for syntax errors at the end."""
        try:
            with open(file_path, "r") as f:
                content = f.readlines()
                return "".join(content[-lines:])
        except Exception as e:
            return f"Error: {str(e)}"

    @ai_function
    def write_to_file(self, file_path: str, content: str):
        """Writes or overwrites a file. USE WITH EXTREME CAUTION."""
        try:
            with open(file_path, "w") as f:
                f.write(content)
            return f"Successfully updated {file_path}."
        except Exception as e:
            return f"Error writing: {str(e)}"

# 3. Initialize with a Debugger Identity
ai = RepoAgent(
    engine, 
    system_prompt=(
        "You are an expert JS Debugger. You can read and write files. "
        "For 'Unexpected end of input' errors, use `read_file_tail` to find missing brackets. "
        "When fixing a file, only write the code if you are 100% sure of the structure."
    )
)

if __name__ == "__main__":
    print("--- Local AI Agent (Ollama + Kani) - WRITE ACCESS ENABLED ---")
    chat_in_terminal(ai)