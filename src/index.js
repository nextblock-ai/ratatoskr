require("dotenv").config();
const blessed = require("blessed");
const fs = require("fs-extra");
const path = require("path");
const ora = require("ora");

const {
    terminal,
    fileList,
    outputLog,
    inputBox,
} = require("./screen");
const {
    loadFiles,
    createConversation,
    getCompletion,
    updateFile,
} = require("./code");

let conversation;
let files;

async function getUserConfirmation() {
    let prompt;
    // return new Promise((resolve, reject) => {
    //     prompt = blessed.prompt({
    //         top: 'center',
    //         left: 'center',
    //         width: '50%',
    //         height: 'shrink',
    //         label: 'Confirmation',
    //         border: { type: 'line' },
    //         keys: true,
    //         mouse: true,
    //     });
    //     prompt.on('click', function(data) {
    //         prompt.focus();
    //     });
    //     terminal.append(prompt);
    //     prompt.show();
    // });
    return true;
}


const yargs = require("yargs");
const argv = yargs.argv;

let targetFolder = argv._[0];

if (!targetFolder) {
    console.error("Please provide a target folder as the first argument.");
    // process.exit(1);
}

// Load the files and populate the fileList component
const loadScreen = async () => {
    files = await loadFiles(targetFolder);
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
} catch(e) {
    console.error(e);
} finally {
    process.stdin.resume();
}

});

fileList.focus();
terminal.render();
terminal.key(['q', 'C-c'], () => process.exit(0));
// terminal.key(['/'], () => {
//     // placeholder - we will add a popup box here to gather a new target folder
//     targetFolder = blessed.helpers.escape(targetFolder);
// });


module.exports = {
    files
}