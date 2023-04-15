const blessed = require("blessed");

// Create a screen object
const screen = blessed.screen({
    smartCSR: true,
    title: "AI Regex Assistant",
});

// Create the title bar
const titleBar = blessed.box({
    top: 0,
    left: 0,
    width: "100%",
    height: 1,
    content: "AI Regex Assistant",
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
    height: "60%",
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
const fileContent = blessed.box({
    top: 1,
    left: "30%",
    width: "70%",
    height: "60%",
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
    top: "60%",
    left: 0,
    width: "100%",
    height: "20%",
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
    height: 3,
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
    content: "Status: Selected file: file1.txt | Updates applied: 0",
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

// Set up event listeners and interaction logic
fileList.on("select", (item) => {
    // Update the file content and status bar when a new file is selected
    fileContent.setContent("New file content goes here");
    statusBar.setContent(`Status: Selected file: ${item.content} | Updates applied: 0`);
    screen.render();
});

inputBox.on("submit", (value) => {
    // Handle user input and update the output log
    outputLog.insertBottom(`User: ${value}`);
    // Call your AI function here and update the output log with the AI response
    outputLog.insertBottom(`AI: AI response goes here`);
    screen.render();
});

// Focus on the file list by default
fileList.focus();

// Render the screen
screen.render();

// Handle exit
screen.key(["q", "C-c"], () => process.exit(0));

module.exports = {
    terminal: screen,
    fileList,
    fileContent,
    outputLog,
    inputBox,
    statusBar,
};
