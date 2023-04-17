require("dotenv").config();

const enquirer = require("enquirer");
const fs = require("fs-extra");
const fsp = require("fs").promises;
const path = require("path");
const ora = require("ora");
const Diff = require("diff");

const { OpenAIApi, Configuration } = require('openai');
const configuration = new Configuration({ apiKey: process.env.OPENAI_KEY });
const openai = new OpenAIApi(configuration);

// Replace this with your actual API key
openai.apiKey = process.env.OPENAI_KEY;


function applyUnifiedDiff(diffString, targetFiles) {
    const parsedDiff = Diff.parsePatch(diffString);
    let result = {};

    for (const fileDiff of parsedDiff) {
        const targetFileContent = targetFiles[fileDiff.oldFileName];
        if (!targetFileContent) continue;

        const patchedContent = Diff.applyPatch(targetFileContent, fileDiff);
        result[fileDiff.newFileName] = patchedContent;
    }

    return result;
}


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
        content: `You are an AI assistant with regex-enabled search-and-replace functionality for modifying files. Your main role is to process and execute commands to edit the files. You are allowed to use control statements to guide the user or respond to user questions using the !echo statement.
Success Signaling:
!success <message>
- <message>: The message to echo back to the user.

Failure Signaling:
!failure <message>
- <message>: The message to echo back to the user.

Shell statement command:
!bash <command>
- <command>: The command to execute in the shell, enclosed in quotes. Use shelljs conventions for escaping characters.
You will be shown the results of execution failures. If the command is successful you will receive its stdout output, and you will have another oppoertunity to act. Perform further action if needed, or output !success <statusmessage> to signal success. If the command fails, you will receive its error output and you will have another opportunity to act. If you cannot resolve the issue, output !failure to acknowledge the failure.

File patch statement format:
!patch <file> <unified_diff_patch>
- <file>: The target file name.
- <unified_diff_patch>: The unified diff patch to apply to the target file, enclosed in quotes.

File edit statement format:
!edit <file> <search_regex> <replace_string>
- <file>: The target file name. You can create new files by specifying a file name that does not exist.
- <search_regex>: The regex to search for in the target file.
- <replace_string>: The string to replace the search regex with.

PREFER patch statements over edit statements. If you cannot use a patch statement, use an edit statement. If you cannot use an edit statement, use a shell statement.

Echo statement format:
!echo <message>
- <message>: The message to echo back to the user.

Make sure to properly encode newlines and special characters in your response.`
    };

    const messages = files.map((file) => ({
        role: "system",
        content: `${file.name}:\n${file.content}`,
    }));

    return [...messages, initialMessage, { role: "user", content: " **CRITICAL** RESPOND ONLY WITH SHELL, EDIT, ECHO, SUCCESS OR FAILURE STATEMENTS AFTER THIS POINT. THIS IS ESSENTIAL!!" }]
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
        temperature: 0.6,
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
    console.log(`Updating file: ${srcPath}`);
    console.log(`New content: ${newContent}`);
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
    getUserConfirmation,
    applyUnifiedDiff
};
