require("dotenv").config();

const enquirer = require("enquirer");
const fs = require("fs-extra");
const path = require("path");
const ora = require("ora");

const { OpenAIApi, Configuration } = require('openai');
const configuration = new Configuration({ apiKey: process.env.OPENAI_KEY });
const openai = new OpenAIApi(configuration);

// Replace this with your actual API key
openai.apiKey = process.env.OPENAI_KEY;

// Load all files in ./src (excluding __test__)
async function loadFiles(targetFolder) {
    const srcPath = path.join(targetFolder);
    let files = await fs.readdir(srcPath);
    files = files
        .filter((file) => !file.includes("__tests__"))
        .filter((file) => fs.lstatSync(path.join(srcPath, file)).isFile());
    files = files
        .map(async (file) => {
            const content = await fs.readFile(path.join(srcPath, file), "utf-8");
            if (content.includes('ratatoskr:exclude')&&file!=='code.js') return undefined;
            return { name: file, content };
        })
        .filter((file) => file !== undefined)
    let fileContents = await Promise.all( files );
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

RESPOND ONLY WITH CONTROL STATEMENTS OR ECHO STATEMENTS.`,
    };

    const messages = files.map((file) => ({
        role: "system",
        content: `The content of ${file.name}:
${file.content}`,
    }));

    // Add the initial message to the conversation
    messages.unshift(initialMessage);
    messages.push({ role: "user", content: "ITS CRITICALLY IMPORTANT FOR YOU TO REMEMBER TO RESPOND ONLY WITH CONTROL STATEMENTS OR ECHO STATEMENTS! THIS IS ESSENTIAL!!" });
    return messages;
}

async function getCompletion(messages, requeryIncompletes = true) {
    const conversation = { model: 'gpt-4', messages, max_tokens: 2048, temperature: 0.05 };
    let isJson = false, responseMessage = '';
    const _query = async (conversation, iter) => {
        let completion = await openai.createChatCompletion(conversation);
        responseMessage += completion.data.choices[0].message.content.trim();
        if (iter === 0 && (responseMessage.startsWith('{') || responseMessage.startsWith('['))) isJson = true;
        if (isJson && requeryIncompletes && !(responseMessage.endsWith('}') || responseMessage.endsWith(']'))) {
            conversation.messages.push({ role: 'assistant', content: responseMessage });
            return _query(conversation, iter + 1);
        }
        return responseMessage;
    }
    return await _query(conversation, 0);
}

// Update the file content and save it
async function updateFile(file, newContent) {
    const srcPath = path.join(__dirname, file);
    fs.writeFileSync(srcPath, newContent, "utf-8");
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
        return `File ${fileName} updated successfully.
The content of ${fileName}:
${newContent}`;
    } else {
        return `File ${fileName} not found.`;
    }
}

async function processEcho(message) {
    return message;
}

async function processMessage(message, files) {
    if (message.startsWith("!edit")) {
        return await processCommand(message, files);
    } else if (message.startsWith("!echo")) {
        return await processEcho(message);
    } else {
        return "Invalid command. Please try again.";
    }
}

async function main() {
    const files = await loadFiles(__dirname);
    const messages = await createConversation(files);
    
    const prompt = await enquirer.prompt({
        type: "input",
        name: "message",
        message: "Enter a command:",
    });
    const spinner = ora("Processing...").start();
    const { message } = await prompt;
    messages.push({ role: "user", content: message });

    const completion = await getCompletion(messages);
    spinner.stop();
    const response = await processMessage(completion, files);
    console.log(response);
}

main();