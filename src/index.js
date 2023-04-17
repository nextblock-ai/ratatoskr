require("dotenv").config();
const {
    loadFiles,
    createConversation,
    getUserInput,
    getCompletion,
    updateFile,
    getUserConfirmation,
    applyUnifiedDiff
} = require("./code");
const shell = require("shelljs");
const path = require("path");

function applyUnifiedDiffFormatPatch(unifiedDiffFormatPatch, fileContent) {
    const patchLines = unifiedDiffFormatPatch.split('\n');
    const fileLines = fileContent.split('\n');
    const newFileLines = [];
    let fileIndex = 0;

    for (let i = 0; i < patchLines.length; i++) {
        const line = patchLines[i];

        if (line.startsWith('@@')) {
            const [from, to] = line
                .match(/@@ -(\d+),\d+ \+(\d+),\d+ @@/i)
                .slice(1)
                .map(Number);

            while (fileIndex < from - 1) {
                newFileLines.push(fileLines[fileIndex]);
                fileIndex++;
            }

            fileIndex = to - 1;
        } else if (line.startsWith('+')) {
            newFileLines.push(line.slice(1));
        } else if (line.startsWith('-')) {
            fileIndex++;
        } else {
            newFileLines.push(fileLines[fileIndex]);
            fileIndex++;
        }
    }

    while (fileIndex < fileLines.length) {
        newFileLines.push(fileLines[fileIndex]);
        fileIndex++;
    }

    return newFileLines.join('\n');
}

(async () => {
    // take a single path parameter as the value
    const shellPath = process.argv[2];
    let query = '';
    if (process.argv.length > 3) {
        query = process.argv.slice(3).join(' ');
    }

    let files = await loadFiles(shellPath);
    if (query === '') {
        console.log(`Loading files from ${shellPath}...`);
        files.forEach((file) => console.log(`Loaded file ${file.name}`))
    }
    let conversation = await createConversation(files);

    // if query is passed from the command line, use it as the first user input
    let requery = false;
    if (query !== '') {
        conversation.push({ role: "user", content: query });
        requery = true;
    }
    while (true) {

        // only gather user input if we are not requerying
        if (!requery) {
            const userInput = await getUserInput();
            if (userInput === '~' || userInput === '!exit'
            ) break;
            conversation.push({ role: "user", content: userInput });
            // remove oldest messages if conversation is too long
            const adjustConversation = (conversation) => {
                const convoString = JSON.stringify(conversation);
                if (convoString.length > 8192) {
                    conversation = conversation.slice(1);
                }
                return conversation;
            }
            let convoString = JSON.stringify(conversation);
            while (convoString.length > 8192) {
                conversation = adjustConversation(conversation);
                convoString = JSON.stringify(conversation);
            }
        }
        const completion = await getCompletion(conversation);

        console.log("AI Response:", completion);
        // Process the edit commands

        const editCommands = completion.matchAll(/!edit\s+\"([^\"]+)\"\s+\"([^\"]+)\"\s+\"([^\"]+)\"/g); // !edit filename "search pattern" "replacement"
        const patchCommands = completion.matchAll(/!patch\s+"([^"]+)"\s+"([^"]+)"/g); // !patch filename "patch"
        const echoCommands = completion.matchAll(/!echo\s+"([^"]+)"/g); // !echo "message"
        const bashCommands = completion.matchAll(/!bash\s+"([^"]+)"/g); // !bash "command"
        const successCommands = completion.matchAll(/!success\s+"([^"]+)"/g); // !success "message"
        const failureCommands = completion.matchAll(/!failure\s+"([^"]+)"/g); // !failure "message"

        for (const command of successCommands) { requery = false; }
        for (const command of failureCommands) { requery = false; }
        for (const command of echoCommands) {
            const [_, message] = command;
            console.log(message);
        }
        // Group the updates by file name
        const updates = {};
        for (const command of editCommands) {
            let [_, fileName, searchPattern, replacement] = command;
            const file = files.find((f) => f.name === fileName);
            if (file) {
                // Use the searchPattern directly to create the RegExp object
                const regex = new RegExp(searchPattern, "g");
                const newContent = file.content.replace(regex, replacement);
                updates[fileName] = newContent;
            } else {
                // create a new file
                updates[fileName] = replacement;
            }
        }
        for (const command of patchCommands) {
            let [_, fileName, patch] = command;
            // strip doublequotes from file name
            // fileName = fileName.replace(/^"(.*)"$/, "$1");
            const file = files.find((f) => f.name === fileName);
            if (file) {
                updates[fileName] = applyUnifiedDiffFormatPatch(patch, file.content);
            }
        }

        // Show the updates to the user and wait for confirmation
        for (let fileName of Object.keys(updates).sort()) {
            console.log(`\nUpdated content for ${fileName}:\n${updates[fileName]}`);
            const confirmed = await getUserConfirmation();
            if (confirmed) {
                const file = files.find((f) => f.name === fileName);
                file.content = updates[fileName];
                const cwd = process.cwd();
                const filePath = path.join(cwd, shellPath, fileName);
                console.log(`Updating file: ${filePath}`);
                console.log(`New content: ${updates[fileName]}`);
                await updateFile(filePath, updates[fileName]);
                console.log(`File ${filePath} updated successfully.`);
            } else {
                console.log(`Changes to ${fileName} were not applied.`);
            }
        }

        let execution = '';
        for (const command of bashCommands) {
            const [_, bashCommand] = command;
            execution += bashCommand + '\n';
            const { stdout, stderr } = shell.exec(bashCommand);
            if (stderr) {
                console.log(stderr);
                execution += 'error: ' + stderr + '\n';
                requery = true;
                break;
            } else {
                execution += stdout + '\n';
                requery = true;
            }
        }
        if (execution !== '') {
            conversation.push({ role: "system", content: execution });
            if (requery) { continue; }
        }
        requery = false;

        for (const command of successCommands) {
            const [_, successMessage] = command;
            console.log(successMessage);
        }

        for (const command of failureCommands) {
            const [_, failureMessage] = command;
            console.log(failureMessage);
        }

        if (query !== '') {
            break;
        }
    }
})();
