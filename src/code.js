require("dotenv").config();

const enquirer = require("enquirer");
const fs = require("fs-extra");
const fsp = require("fs").promises;
const path = require("path");
const blessed = require("blessed");
const ora = require("ora");

const { OpenAIApi, Configuration } = require('openai');
const configuration = new Configuration({ apiKey: process.env.OPENAI_KEY });
const openai = new OpenAIApi(configuration);

// Replace this with your actual API key
openai.apiKey = process.env.OPENAI_KEY;

// Load all files in ./src (excluding __test__)
async function loadFiles(shellPath) {
    const cwd = process.cwd();
    const srcPath = path.join(cwd, shellPath);

    async function loadFilesRecursively(dirPath) {
        let files = await fsp.readdir(dirPath);
        let fileContents = [];
        for (const file of files) {
            const fPath = path.join(dirPath, file);
            if (file.includes("__tests__") || file.includes("node_modules")) {
                continue;
            }
            const stats = await fs.lstat(fPath);
            if (stats.isDirectory()) {
                const subDirFiles = await loadFilesRecursively(fPath);
                fileContents = fileContents.concat(subDirFiles);
            } else {
                const content = await fs.readFile(fPath, "utf-8");
                if (content.includes("gpt-exclude: true")) {
                    console.log(`Excluding file ${file} from training data`);
                } else {
                    fileContents.push({ name: file, content });
                }
            }
        }
        return fileContents;
    }
    return await loadFilesRecursively(srcPath);
}

// Create an OpenAI conversation with the contents of the loaded files
async function createConversation(files) {
    // Add an initial message to inform the AI of its role and command capabilities
    const initialMessage = {
        role: "system",
        content: `As an AI assistant, you can edit files using regex search-and-replace, execute shell commands, and respond to user questions.

You can issue out commands by outputting an exclamation mark (!) at the beginning of a line with the command immediately following.

Signal success: 

!success <message>
Signal failure: 

!failure <message>

Shell command: 

!bash <command> (Use shelljs conventions for escaping characters)
Control statement: 

!edit <file> <search_pattern> <replacement>
Echo statement: 

!echo <message>

If the user issues shell commands, pretend to be a file system with files in this chat window. Encode newlines and special characters properly.`
    };

    const messages = files.map((file) => ({
        role: "system",
        content: `${file.name}:\n\n${file.content}`,
    }));

    // Add the initial message to the conversation
    messages.unshift(initialMessage);
    messages.push({ role: "user", content: " **CRITICAL** RESPOND ONLY WITH SHELL, EDIT, ECHO, SUCCESS OR FAILURE STATEMENTS. THIS IS ESSENTIAL!!" });
    return messages;
}

// Get user input
async function getUserInput() {
    const response = await enquirer.prompt({
        type: "input",
        name: "input",
        message: "Enter your instruction:",
    });
    return response.input;
}

async function getCompletion(messages, requeryIncompletes = true) {
    const conversation = {
        model: 'gpt-4',
        messages,
        max_tokens: 2048,
        temperature: 0.02,
    }
    let isJson = false, responseMessage = '';
    const _query = async (conversation, iter) => {
        const spinner = ora("Querying GPT-4").start();
        let completion = await openai.createChatCompletion(conversation);
        spinner.stop();
        let response = await new Promise((resolve) => {
            responseMessage += completion.data.choices[0].message.content.trim();
            if (iter === 0 && responseMessage.startsWith('{') || responseMessage.startsWith('[')) {
                isJson = true;
            }
            if (isJson && requeryIncompletes) {
                if (responseMessage.endsWith('}') || responseMessage.endsWith(']')) {
                    return resolve(responseMessage);
                } else {
                    conversation.messages.push({ role: 'assistant', content: response });
                    responseMessage += completion;
                    return resolve(_query(conversation, iter + 1));
                }
            } else return resolve(completion.data.choices[0].message.content.trim());
        });
        return responseMessage;
    }
    const completion = await _query(conversation, 0);
    return completion;
};

// Update the file content and save it
async function updateFile(file, newContent) {
    const srcPath = path.join(file);
    await fs.writeFile(srcPath, newContent, "utf-8");
}

async function getUserConfirmation() {
    const response = await enquirer.prompt({
        type: "confirm",
        name: "confirmed",
        message: "Do you want to apply the changes?",
    });
    return response.confirmed;
}

module.exports = {
    loadFiles,
    createConversation,
    getUserInput,
    getCompletion,
    updateFile,
    getUserConfirmation
};
