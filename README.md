# Ratatoskr

Ratatoskr is an AI-powered coding assistant that helps you search and replace text in files using regular expressions it returns in response to your code requests. Rototoskr leverages the power of OpenAI's GPT-4 to understand your instructions and perform the required modifications to the files.

## Features

- Load files from a specified folder
- Display file content and allow file selection
- Receive user instructions for search and replace operations
- Utilize OpenAI's GPT-4 to process instructions and generate regex patterns
- Apply changes to the files based on the generated regex patterns
- Display output log with user instructions and AI responses

## Installation

### Using the Installer

To **install** or **update** rototoskr, you should run the [install script][2]. To do that, you may either download and run the script manually, or use the following cURL or Wget command:

```sh
curl -o- https://raw.githubusercontent.com/nextblock-ai/rototoskr/v0.0.1/install.sh | bash
```
```sh
wget -qO- https://raw.githubusercontent.com/nextblock-ai/rototoskr/v0.0.1/install.sh | bash
```

The install process will ask you for an OpenAI API key. You can get one [here][1].

[1]: https://beta.openai.com/account/api-keys
[2]: https://raw.githubusercontent.com/nextblock-ai/rototoskr/v0.0.1/install.sh

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