require("dotenv").config();
// ratatoskr:exclude
const fs = require("fs-extra");
const path = require("path");
const blessed = require("blessed");
const contrib = require("blessed-contrib");
const yargs = require("yargs");

async function main() {
    // the entire UI is nicely encapsulated in a single function
    const jsonConfig = {
        "titleBar": { type: "box", top: 0, left: 0, width: "100%", height: 1, content: 'Ratatoskr', style: { fg: "white", bg: "blue", } },
        "fileList": { type: "list", top: 1, left: 0, width: "30%", height: "50%", label: "Files", border: { type: "line", }, style: { selected: { bg: "blue", }, }, keys: true, mouse: true, items: [], },
        "outputLog": { type: "textarea", top: "52%", left: 0, width: "100%", height: "35%", label: "Output Log", content: "", scrollable: true, alwaysScroll: true, scrollbar: { ch: " ", inverse: true, }, border: { type: "line", }, keys: true, mouse: true },
        "inputBox": { type: "textbox", bottom: 1, left: 0, width: "100%", height: 5, label: "[Input]", border: { type: "line", }, inputOnFocus: true, keys: true, mouse: true },
        "statusBar": { type: "box", bottom: 0, left: 0, width: "100%", height: 1, content: "", style: { fg: "white", bg: "blue", }, },
    }
    const contribConfig = {
        "fileContent": { type: "markdown", top: 1, left: "30%", width: "70%", height: "50%", label: "File Content", content: "", scrollable: true, alwaysScroll: true, scrollbar: { ch: " ", inverse: true, }, border: { type: "line", }, keys: true, mouse: true },
    }

    // Create a screen object
    const terminal = blessed.screen({
        smartCSR: true,
        title: 'AI Assistant',
    });
    const [
        titleBar,
        fileList,
        outputLog,
        inputBox,
        statusBar,
    ] = Object.values(jsonConfig).map((config) => blessed[config.type](config)).map((element) => {
        return element;
    });
    const [
        fileContent,
    ] = Object.values(contribConfig).map((config) => contrib[config.type](config)).map((element) => {

        return element;
    });
    [
        titleBar,
        fileList,
        fileContent,
        outputLog,
        inputBox,
        statusBar,
    ].forEach((element) => {
        terminal.append(element);
    });

    // openai configuration
    const { OpenAIApi, Configuration } = require('openai');
    const configuration = new Configuration({ apiKey: process.env.OPENAI_KEY });
    const openai = new OpenAIApi(configuration);
    openai.apiKey = process.env.OPENAI_KEY;

    // Load all files in the target folder  
    function loadFiles(targetFolder) {
        const files = (fs.readdirSync(targetFolder)).filter(file => fs.lstatSync(path.join(targetFolder, file)).isFile());
        const fileContents = files.map(file => {
            const content = fs.readFileSync(path.join(targetFolder, file), "utf-8");
            return content.includes('ratatoskr:exclude') && file !== 'index.js' ? undefined : { name: file, content };
        })
        return fileContents.filter(file => file !== undefined);
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

    let conversation;

    async function getUserConfirmation(screen) {
        let prompt;
        return new Promise((resolve, reject) => {
            prompt = blessed.prompt({
                parent: screen,
                top: 'center',
                left: 'center',
                width: '50%',
                height: 'shrink',
                label: 'Confirmation',
                border: { type: 'line' },
                keys: true,
                mouse: true,
            });
            prompt.on('click', function (data) {
                prompt.focus();
            });
            terminal.append(prompt);
            prompt.show();
        });
        return true;
    }

    const argv = yargs.argv;

    let targetFolder = argv._[0];
    if (!targetFolder) {
        console.error("Please provide a target folder as the first argument.");
        process.exit(1);
    }
    let files = await Promise.all(loadFiles(targetFolder));

    // Load the files and populate the fileList component
    const loadScreen = async () => {
        files = loadFiles(targetFolder);
        const fileNames = files.map((file) => file.name);
        fileList.setItems(fileNames);
        conversation = !conversation ? await createConversation(files) : conversation;
        terminal.render();
    };
    loadScreen();


    inputBox.on("submit", async (value) => {
        outputLog.insertBottom(`User: ${value}`);
        terminal.render();

        conversation.push({ role: "user", content: value });
        const completion = await getCompletion(conversation);
        outputLog.insertBottom(`AI: ${completion}`);
        terminal.render();

        const editCommands = completion.matchAll(/!edit\s+"((?:\\"|[^"])*)"\s+"((?:\\"|[^"])*)"\s+"((?:\\"|[^"])*)"/g);
        const updates = {};
        for (const command of editCommands) {
            const [_, fileName, searchPattern, replacement] = command;
            const file = files.find((f) => f.name === fileName);
            if (file) {
                const regex = new RegExp(searchPattern, "g");
                // we need to remove the backslashes from the replacement string but save the newlines
                const replacement = command[3].replace(/\\n/g, "\n").replace(/\\(.)/g, "$1");
                const newContent = file.content.replace(regex, replacement);
                updates[fileName] = newContent;
            }
        }
        try {
            for (const fileName of Object.keys(updates).sort()) {
                const confirmed = await getUserConfirmation();
                if (confirmed) {
                    const file = files.find((f) => f.name === fileName);
                    file.content = updates[fileName];
                    await updateFile(fileName, updates[fileName]);
                    outputLog.insertBottom(`File ${fileName} updated successfully.`);
                } else {
                    outputLog.insertBottom(`Changes to ${fileName} were not applied.`);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            process.stdin.resume();
        }

    });

    // Update event listeners and interaction logic
    fileList.on("select", async (item) => {
        const fileName = item.content;
        const file = files.find((f) => f.name === fileName);
        fileContent.setMarkdown(`\`\`\`javascript\n${file.content}\n\`\`\``);
        statusBar.setContent(`Status: Selected file: ${fileName} | Updates applied: 0`);
        terminal.render();
    });


    fileList.focus();
    terminal.render();
    terminal.key(['q', 'C-c'], () => process.exit(0));
    terminal.key(['/'], () => {
        // placeholder - we will add a popup box here to gather a new target folder
        targetFolder = blessed.helpers.escape(targetFolder);
    });
}
main();