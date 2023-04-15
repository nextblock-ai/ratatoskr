#!/bin/bash

# Check if git is installed
if ! command -v git >/dev/null 2>&1; then
  echo "Error: git is not installed. Please install git and try again."
  exit 1
fi

# Check if the Ratatoskr repository already exists in the user's home folder
if [ -d ~/.ratatoskr ]; then
  echo "Ratatoskr repository already exists. Updating to the latest version..."
  cd ~/.ratatoskr || exit
  git pull origin main
else
  # Clone the Ratatoskr repository into the user's home folder
  echo "Cloning Ratatoskr repository..."
  git clone https://github.com/nextblock-ai/ratatoskr.git ~/.ratatoskr
fi

# Detect the user's shell
user_shell=$(basename "$SHELL")

# Add Ratatoskr to the PATH
echo "Adding Ratatoskr to the PATH..."
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

# Prompt the user for their OpenAI API key
echo "Please enter your OpenAI API key:"
read -r openai_api_key

# Save the OpenAI API key to a .env file in the Ratatoskr home folder
echo "Saving your OpenAI API key to the .env file..."
echo "OPENAI_API_KEY=${openai_api_key}" >~/.ratatoskr/.env

echo "Ratatoskr has been installed/updated successfully!"

echo "Please restart your shell or run 'source ~/.bashrc' (for bash) or 'source ~/.zshrc' (for zsh) to complete the installation."
echo "If you experience any issues, try adding the following line to your shell configuration file (e.g. ~/.bashrc or ~/.zshrc):"
echo 'export PATH="$HOME/.ratatoskr/bin:$PATH"'