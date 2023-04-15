# Ratatoskr

Ratatoskr is an AI-powered coding assistant that removes the manual coding required whem working with most GPT extensions. Ratatoskr leverages the power of OpenAI's GPT-4 to understand your instructions and perform the required modifications to the files via a set of commands it uses to answer your questions. This turns the AI's response into a set of actions that are then applied to the files, making Ratatoskr a powerful tool for developers.

## Features

- Load files from a specified folder
- Display file contents in a colorized code view
- Use the arrow keys to navigate the file list
- Press Enter to select a file to view it
- Type your instruction in the input box and press Enter to submit
- The AI will process your instruction and show you the proposed changes
- Press `y` to accept the pattern or `n` to reject it
- Press `q` or `C-c` to exit the application

## Installation

You can install ratatoskr using the [install script][2] or manually.

### Using the Installer

To **install** or **update** ratatoskr, you should run the [install script][2]. To do that, you may either download and run the script manually, or use the following cURL or Wget command:

```sh
curl -o- https://raw.githubusercontent.com/nextblock-ai/ratatoskr/v0.0.1/install.sh | bash
```
```sh
wget -qO- https://raw.githubusercontent.com/nextblock-ai/ratatoskr/v0.0.1/install.sh | bash
```

*Note about the Install Script:* You need to run the install script in an interactive shell. If you are using a non-interactive shell, you can run the script with the `--interactive` flag:

```sh
curl -o- https://raw.githubusercontent.com/nextblock-ai/ratatoskr/v0.0.1/install.sh | bash -s -- --interactive
```
```sh
wget -qO- https://raw.githubusercontent.com/nextblock-ai/ratatoskr/v0.0.1/install.sh | bash -s -- --interactive
```

If that doesn't work, follow the manual installation instructions below then add the `ratatoskr` command to your path:
    
    ```sh
    export PATH="$PATH:$(npm bin -g)"
    ```

### OpenAI API Key

The install process will ask you for an OpenAI API key. You can get one [here][1].

[1]: https://beta.openai.com/account/api-keys
[2]: https://raw.githubusercontent.com/nextblock-ai/ratatoskr/v0.0.1/install.sh

### Manually

1. Clone the repository:

```
git clone https://github.com/nextblock-ai/ratatoskr.git
```

2. Change to the project directory:

```
cd ratatoskr
```

3. Install the required dependencies:

```
npm install
```

4. Set up your OpenAI API key:

Create a `.env` file in the project root directory and add your OpenAI API key:

```
OPENAI_KEY=your_openai_api_key
```

## Usage

1. Run the application with the target folder as the first argument:

```
node index.js target_folder
```

2. Use the arrow keys to navigate the file list and press Enter to select a file to view it

3. Type your instruction in the input box and press Enter to submit.

4. The AI will process your instruction and show you the proposed changes. Press `y` to accept the pattern or `n` to reject it.

5. Press `q` or `C-c` to exit the application.

## License

Ratatoskr is released under the MIT License. See the [LICENSE](LICENSE) file for more information.