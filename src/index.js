require("dotenv").config();
const {
    loadFiles,
    createConversation,
    getUserInput,
    getCompletion,
    updateFile,
    getUserConfirmation,
} = require("./code");
const shell = require("shelljs");
const path = require("path");

(async () => {
    // take a single path parameter as the value
    const shellPath = process.argv[2];
    let query = '';
    if(process.argv.length > 3) {
        query = process.argv.slice(3).join(' ');
    }

    let files = await loadFiles(shellPath);
    if(query === '') {
        console.log(`Loading files from ${shellPath}...`);
        files.forEach((file) => console.log(`Loaded file ${file.name}`))
    }
    let conversation = await createConversation(files);

    // if query is passed from the command line, use it as the first user input
    let requery = false;
    if(query !== '') {
        conversation.push({ role: "user", content: query });
        requery = true;
    }
    while (true) {

        // only gather user input if we are not requerying
        if(!requery) {
            const userInput = await getUserInput();
            if (userInput === '~' || userInput === '!exit'
            ) break;
            conversation.push({ role: "user", content: userInput });
            // TODO - remove oldest messages if conversation is too long
        }
        const completion = await getCompletion(conversation);

        console.log("AI Response:", completion);
        // Process the edit commands
        const editCommands = completion.matchAll(/!edit\s+(\S+)\s+"([^"]+)"\s+"([^"]+)"/g);
        const echoCommands = completion.matchAll(/!echo\s+"([^"]+)"/g);
        const bashCommands = completion.matchAll(/!bash\s+"([^"]+)"/g);
        const successCommands = completion.matchAll(/!success\s+"([^"]+)"/g);
        const failureCommands = completion.matchAll(/!failure\s+"([^"]+)"/g);
        
        for(const command of successCommands) {
            requery = false;
        }
        for(const command of failureCommands) {
            requery = false
        }
        for(const command of echoCommands) {
            const [_, message] = command;
            console.log(message);
        }
        // Group the updates by file name
        const updates = {};
        for (const command of editCommands) {
            let [_, fileName, searchPattern, replacement] = command;
            // strip doublequotes from file name
            fileName = fileName.replace(/^"(.*)"$/, "$1");
            const file = files.find((f) => f.name === fileName);
            if (file) {
                const regex = new RegExp(searchPattern, "g");
                const newContent = file.content.replace(regex, replacement);
                updates[fileName] = newContent;
            } else {
                // create a new file
                updates[fileName] = replacement;
            }
        }

        // Show the updates to the user and wait for confirmation
        for (let fileName of Object.keys(updates).sort()) {
            console.log(`\nUpdated content for ${fileName}:\n${updates[fileName]}`);
            const confirmed = await getUserConfirmation();
            if (confirmed) {
                const file = files.find((f) => fileName === '"' +  f.name + '"' || f.name === fileName);
                file.content = updates[fileName];
                const cwd = process.cwd();
                const filePath = path.join(cwd, shellPath, fileName);
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
                requery = false;
            }
        }
        if(execution !== '') {
            conversation.push({ role: "system", content: execution });
            if(requery) { continue; }
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
    }
})();

  // ...