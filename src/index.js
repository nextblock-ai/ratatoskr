require("dotenv").config();
const blessed = require("blessed");
const fs = require("fs-extra");
const path = require("path");
const ora = require("ora");
const { OpenAIApi, Configuration } = require("openai");
const configuration = new Configuration({ apiKey: process.env.OPENAI_KEY });
const openai = new OpenAIApi(configuration);
const {
    terminal,
    fileList,
    fileContent,
    outputLog,
    inputBox,
    statusBar,
} = require("./screen");
const {
    loadFiles,
    createConversation,
    getUserInput,
    getCompletion,
    updateFile,
    getUserConfirmation,
    processCommand,
} = require("./code");

openai.apiKey = process.env.OPENAI_KEY;

let conversation;
let files;

const yargs = require("yargs");
const argv = yargs.argv;

const targetFolder = argv._[0];

if (!targetFolder) {
    console.error("Please provide a target folder as the first argument.");
    process.exit(1);
}

// Load the files and populate the fileList component
(async () => {
    files = await loadFiles(targetFolder);
    const fileNames = files.map((file) => file.name);
    fileList.setItems(fileNames);
    conversation = await createConversation(files);
    terminal.render();
})();

// Update event listeners and interaction logic
fileList.on("select", async (item) => {
    const fileName = item.content;
    const file = files.find((f) => f.name === fileName);
    fileContent.setContent(file.content);
    statusBar.setContent(`Status: Selected file: ${fileName} | Updates applied: 0`);
    terminal.render();
});

inputBox.on("submit", async (value) => {
    outputLog.insertBottom(`User: ${value}`);
    terminal.render();

    conversation.push({ role: "user", content: value });
    const completion = await getCompletion(conversation);
    outputLog.insertBottom(`AI: ${completion}`);
    terminal.render();

    const editCommands = completion.matchAll(/!edit\s+(\S+)\s+"([^"]+)"\s+"([^"]+)"/g);
    const updates = {};
    for (const command of editCommands) {
        const [_, fileName, searchPattern, replacement] = command;
        const file = files.find((f) => f.name === fileName);

        if (file) {
            const regex = new RegExp(searchPattern, "g");
            const newContent = file.content.replace(regex, replacement);
            updates[fileName] = newContent;
        }
    }

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
    terminal.render();
});

fileList.focus();
terminal.render();
terminal.key(["q", "C-c"], () => process.exit(0));