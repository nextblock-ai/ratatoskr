const blessed = require("blessed");
const contrib = require("blessed-contrib");
const {files} = require("../src/index");

// Create a screen object
const screen = blessed.screen({
    smartCSR: true,
    title: 'AI Assistant',
});

// Create the title bar
const titleBar = blessed.box({
    top: 0,
    left: 0,
    width: "100%",
    height: 1,
    content: 'Ratatoskr',
    style: {
        fg: "white",
        bg: "blue",
    },
});

// Create the file list
const fileList = blessed.list({
    top: 1,
    left: 0,
    width: "30%",
    height: "50%",
    label: "Files",
    border: {
        type: "line",
    },
    style: {
        selected: {
            bg: "blue",
        },
    },
    keys: true,
    mouse: true,
    items: [], // Populate this with file names
});

// Create the file content box
const fileContent = contrib.markdown({
    top: 1,
    left: "30%",
    width: "70%",
    height: "50%",
    label: "File Content",
    content: "", // Populate this with the content of the selected file
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
        ch: " ",
        inverse: true,
    },
    border: {
        type: "line",
    },
    keys: true,
    mouse: true,
});

// Create the output log
const outputLog = blessed.textarea({
    top: "52%",
    left: 0,
    width: "100%",
    height: "35%",
    label: "Output Log",
    content: "", // Update this with AI responses and results
    scrollable: true,
    alwaysScroll: true,
    scrollbar: {
        ch: " ",
        inverse: true,
    },
    border: {
        type: "line",
    },
    keys: true,
    mouse: true,
});

// Create the input box
const inputBox = blessed.textbox({
    bottom: 1,
    left: 0,
    width: "100%",
    height: 5,
    label: "[Input]",
    border: {
        type: "line",
    },
    inputOnFocus: true,
    keys: true,
    mouse: true,
});

// Create the status bar
const statusBar = blessed.box({
    bottom: 0,
    left: 0,
    width: "100%",
    height: 1,
    content: "",
    style: {
        fg: "white",
        bg: "blue",
    },
});

// Append all components to the screen
screen.append(titleBar);
screen.append(fileList);
screen.append(fileContent);
screen.append(outputLog);
screen.append(inputBox);
screen.append(statusBar);

// Update event listeners and interaction logic
fileList.on("select", async (item) => {
    const fileName = item.content;
    const file = files.find((f) => f.name === fileName);
    fileContent.setMarkdown(`\`\`\`javascript\n${file.content}\n\`\`\``);
    statusBar.setContent(`Status: Selected file: ${fileName} | Updates applied: 0`);
    terminal.render();
});

module.exports = {
    terminal: screen,
    fileList,
    fileContent,
    outputLog,
    inputBox,
    statusBar
};
