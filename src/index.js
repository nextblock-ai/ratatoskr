require("dotenv").config();
const {
    loadFiles,
    createConversation,
    getUserInput,
    getCompletion,
    getUserConfirmation,
    applyUnifiedDiff
} = require("./code");
const shell = require("shelljs");
const path = require("path");
const fs = require("fs");
const { jsonrepair } = require("jsonrepair");

function applyunifiedDiffFormatPatch(unifiedDiffFormatPatch, fileContent) {
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

function parseCommands(commands) {
    //let result = jsonrepair(commands)
    return JSON.parse( commands );
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
    let messages = await createConversation(files, query);
    // let totalBytes = JSON.stringify(messages).length;
    // if (totalBytes > 8192) {
    //     console.log(`WARNING: conversation is too long ${totalBytes} and will be truncated`)
    // }

    // if query is passed from the command line, use it as the first user input
    let requery = false;
    if (query !== '') {
        messages = await createConversation(files, query);
        requery = true;
    }

    async function completeAndProcess(messages) {
        const completion = await getCompletion(messages);
        let commands = parseCommands(completion);
        if(commands.response) commands = commands.response;

        let updatedFilePatches = commands.updatedFiles ? commands.updatedFiles : ''
        let updatedFileExplanations = updatedFilePatches.explanations ? updatedFilePatches.explanations : ''
        let updatedFileDiffs = updatedFilePatches.unifiedDiffFormat ? updatedFilePatches.unifiedDiffFormat : ''
        let conversationalResponse = commands.conversationalResponse ? commands.conversationalResponse : ''
        
        if(conversationalResponse) console.log(conversationalResponse);
        if(!updatedFilePatches && !conversationalResponse && !updatedFileExplanations && commands) {
            console.log(commands);
            return;
        }

        if(updatedFileDiffs && updatedFileExplanations) for(let i = 0; i < Object.keys(updatedFileDiffs).length; i++) {
            let fileName = Object.keys(updatedFileDiffs)[i];
            let fileContent = updatedFileDiffs[fileName]
            const file = files.find((f) => f.name.endsWith(fileName));
            if (file) {
                const confirmed = await getUserConfirmation(explanation[fileName]);
                if (!confirmed) { continue; }
                const fpath = path.join(process.cwd(), shellPath, fileName);
                const newContent = applyunifiedDiffFormatPatch(fileContent, file.content);
                fs.writeFileSync(fpath, newContent, "utf-8");
                file.content = newContent;
            }
        }
        return ''
    }

    let timeout = null, autoInvoke = false;
    function setAutoInvoke(state) {
        if(state === true) {
            autoInvoke = true;
        } else {
            clearTimeout(timeout);
            autoInvoke = false;
        }
    }

    let userInput = '';
    while (true) {
        // only gather user input if we are not requerying
        if (!requery) {
            if(!autoInvoke) {
                userInput = await getUserInput();
                if (userInput === '~' || userInput === '!exit'
                ) break;
                messages = await createConversation(files, userInput);
            }
        }

        // perform the completion and processing
        const execution = await completeAndProcess(messages);
        requery = false;
        if (query !== '') { break; }
        if(autoInvoke) {
            timeout = setTimeout(() => {
                completeAndProcess(messages);
            }, 1000);
        }
    }
})();
