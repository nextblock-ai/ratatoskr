require("dotenv").config();

const enquirer = require("enquirer");
const fs = require("fs-extra");
const path = require("path");
const shell = require("shelljs");
const {
    loadFiles,
    getCompletion,
    applyUnifiedDiff,
} = require('./util');
const {
    queryCodebase,
    queryDependencies,
    getUserInput,
    getUserConfirmation,
    createConversation,
} = require('./prompt');

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
    }
    let messages = createConversation(files, query);

    let requery = false;
    if (query !== '') {
        messages = createConversation(files, query);
        requery = true;
    }

    async function completeAndProcess(messages) {
        const completion = await getCompletion(messages);
        let commands = JSON.parse(completion);
        if (commands.response) commands = commands.response;

        let updatedFilePatches = commands.updatedFiles ? commands.updatedFiles : ''
        let bashCommands = commands.bashCommands ? commands.bashCommands : ''
        let updatedFileExplanations = updatedFilePatches.explanations ? updatedFilePatches.explanations : ''
        let updatedFileDiffs = updatedFilePatches.unifiedDiffFormat ? updatedFilePatches.unifiedDiffFormat : ''
        let conversationalResponse = commands.conversationalResponse ? commands.conversationalResponse : ''

        if (conversationalResponse) console.log(conversationalResponse);
        if (!updatedFilePatches && !conversationalResponse && !updatedFileExplanations && commands) {
            console.log(commands);
            return;
        }

        if (updatedFileDiffs && updatedFileExplanations)
            for (let i = 0; i < Object.keys(updatedFileDiffs).length; i++) {
                let fileName = Object.keys(updatedFileDiffs)[i];
                let fileContent = updatedFileDiffs[fileName]
                const file = files.find((f) => f.name.endsWith(fileName));
                if (file) {
                    const confirmed = await getUserConfirmation(updatedFileExplanations[fileName] + '\n' + updatedFileDiffs[fileName] );
                    if (!confirmed) { continue; }
                    const fpath = path.join(process.cwd(), shellPath, fileName);
                    const newContent = applyUnifiedDiff(fileContent, file.content);
                    if(!newContent.error && newContent.patchedContent) {
                        fs.writeFileSync(fpath, newContent.patchedContent, "utf-8");
                        file.content = newContent.patchedContent;
                    } else {
                        console.log(newContent.error);
                    }
                }
            }
        if (bashCommands) {
            for (let i = 0; i < bashCommands.length; i++) {
                shell.exec(bashCommands[i]);
            }
        }
        return ''
    }

    let userInput = '', autoInvoke = false;
    while (true) {
        // only gather user input if we are not requerying
        if (!requery) {
            if (!autoInvoke) {
                userInput = await getUserInput();
                if (userInput === '~' || userInput === '!exit'
                ) break;
                
                files = await loadFiles(shellPath);
                let loadedFiles = {};
                // get a list of all the file names in the files list
                const filenames = files.map((file) => {
                    const ppart = file.name.split('.')[0]
                    const parts = ppart.split('/')
                    return parts[parts.length - 1]
                });
                
                // check to see if a file name is contained in the user input
                let matches = filenames.filter((filename) => userInput.includes(filename));
                // remove duplicates
                matches = [...new Set(matches)];
                
                for(let i = 0; i < matches.length; i++) {
                    const match = matches[i];
                    console.log(`Loading dependencies for ${match}...`);
                    const theFile = files.find((file) => file.name.includes(match))
                    loadedFiles[theFile.name] = theFile.content;
                    const fileDeps = await queryDependencies(
                        shellPath,
                        theFile.content,
                    );
                    // go through the files and add the dependencies to the loadedFiles object
                    for(let j = 0; j < fileDeps.length; j++) {
                        const fileDep = fileDeps[j];
                        loadedFiles[fileDep] = true;
                    }
                }
                // if the user input matches a filename, then load the file
                // if the user input matches a directory, then load all the files in the directory
                loadedFiles = Object.values(loadedFiles).length > 0 ? loadedFiles : files;
                messages = createConversation(loadedFiles, userInput);
            }
        }

        // perform the completion and processing
        const execution = await commandLoop(messages);
        requery = false;
        if (query !== '') { break; }
        if (autoInvoke) {
            timeout = setTimeout(() => {
                commandLoop(messages);
            }, 1000);
        }
    }
})();

module.exports = {
    queryCodebase
}