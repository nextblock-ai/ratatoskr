require("dotenv").config();

const enquirer = require("enquirer");
const fs = require("fs-extra");
const path = require("path");
const blessed = require("blessed");
const ora = require("ora");

const { OpenAIApi, Configuration } = require('openai');
const configuration = new Configuration({ apiKey: process.env.OPENAI_KEY });
const openai = new OpenAIApi(configuration);

// Replace this with your actual API key
openai.apiKey = process.env.OPENAI_KEY;

// Load all files in ./src (excluding __test__)
async function loadFiles(targetFolder) {
    const srcPath = path.join(__dirname, targetFolder);
    let files = await fs.readdir(srcPath);
    files = files
        .filter((file) => !file.includes("__tests__"))
        .map(async (file) => {
            const content = await fs.readFile(path.join(srcPath, file), "utf-8");
            if (content.includes('gpt-exclude: true')) return undefined;
            return { name: file, content };
        })
        .filter((file) => file !== undefined)
    let fileContents = await Promise.all(
        files
    );
    fileContents = fileContents.filter((file) => file !== undefined);

    return fileContents;
}

// Create an OpenAI conversation with the contents of the loaded files
async function createConversation(files) {
    // Add an initial message to inform the AI of its role and command capabilities
    const initialMessage = {
        role: "system",
        content: `You are an AI assistant with regex-enabled search-and-replace functionality for modifying files. Your main role is to process and execute commands to edit the files. You are allowed to use control statements to guide the user or respond to user questions using the !echo statement.

Control statement format:
!edit <file> <search_pattern> <replacement>

- <file>: The target file name.
- <search_pattern>: The regex pattern to search for in the file, enclosed in quotes.
- <replacement>: The replacement string, enclosed in quotes.

Echo statement format:
!echo <message>

- <message>: The message to echo back to the user.

Make sure to properly encode newlines and special characters in your response. RESPOND ONLY WITH CONTROL STATEMENTS OR ECHO STATEMENTS.`,
    };

    const messages = files.map((file) => ({
        role: "system",
        content: `The content of ${file.name}:\n${file.content}`,
    }));

    // Add the initial message to the conversation
    messages.unshift(initialMessage);
    messages.push({ role: "user", content: "ITS CRITICALLY IMPORTANT FOR YOU TO REMEMBER TO RESPOND ONLY WITH CONTROL STATEMENTS OR ECHO STATEMENTS! THIS IS ESSENTIAL!!" });
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
        temperature: 0.2,
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
    const srcPath = path.join(__dirname, "src", file);
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

async function processCommand(command, files) {
    const [_, fileName, searchPattern, replacement] = command.match(
        /!edit\s+(\S+)\s+"([^"]+)"\s+"([^"]+)"/
    );
    const file = files.find((f) => f.name === fileName);
    if (file) {
        const regex = new RegExp(searchPattern, "g");
        const newContent = file.content.replace(regex, replacement);
        // Update the file content, save it, and return the updated content
        file.content = newContent;
        await updateFile(fileName, newContent);
        return `File ${fileName} updated successfully.\nThe content of ${fileName}:\n${newContent}`;
    } else {
        return `File ${fileName} not found.`;
    }
}

module.exports = {
    loadFiles,
    createConversation,
    getUserInput,
    getCompletion,
    updateFile,
    getUserConfirmation,
    processCommand,
};
