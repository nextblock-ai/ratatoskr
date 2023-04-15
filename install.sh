#!/bin/bash

# Check if git is installed
if ! command -v git >/dev/null 2>&1; then
  echo "Error: git is not installed. Please install git and try again."
  exit 1
fi

# Clone the Rototoskr repository into the user's home folder
echo "Cloning Rototoskr repository..."
git clone https://github.com/nextblock-ai/rototoskr.git ~/.ratatoskr

# Detect the user's shell
user_shell=$(basename "$SHELL")

# Add Rototoskr to the PATH
echo "Adding Rototoskr to the PATH..."
case $user_shell in
  "bash")
    echo 'export PATH="$HOME/.ratatoskr/bin:$PATH"' >>~/.bashrc
    ;;
  "zsh")
    echo 'export PATH="$HOME/.ratatoskr/bin:$PATH"' >>~/.zshrc
    ;;
  *)
    echo "Error: Unsupported shell. Please add the following line to your shell configuration file manually:"
    echo 'export PATH="$HOME/.ratatoskr/bin:$PATH"'
    exit 1
    ;;
esac

# Reload the shell
echo "Reloading the shell..."
source ~/.bashrc

# Prompt the user for their OpenAI API key
echo "Please enter your OpenAI API key:"
read -r openai_api_key

# Save the OpenAI API key to a .env file in the Rototoskr home folder
echo "Saving your OpenAI API key to the .env file..."
echo "OPENAI_API_KEY=${openai_api_key}" >~/.ratatoskr/.env

# Check if Rototoskr is installed
if command -v rototoskr >/dev/null 2>&1; then
  echo "Rototoskr has been installed successfully!"
else
  echo "Error: Rototoskr installation failed. Please add the following line to your shell configuration file (e.g., ~/.bashrc, ~/.zshrc) manually:"
  echo 'export PATH="$HOME/.ratatoskr/bin:$PATH"'
fi