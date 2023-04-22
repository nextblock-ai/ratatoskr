require("dotenv").config();

const enquirer = require("enquirer");
const fs = require("fs-extra");
const fsp = require("fs").promises;
const path = require("path");
const ora = require("ora");
const Diff = require("diff");

const {
    applyunifiedDiffFormatPatch,
    loadFiles,
    getCompletion
} = require('./util');

async function getFileSet(files) {
    const fileSet = {};
    files.forEach((file) => { fileSet[file.name] = file.content; });
    return fileSet;
}

function getSystemPreambleMessage() {
    return {
        role: "system",
        content: JSON.stringify({
            instructions: `You are a code assistant AI. Build a JSON response to the user code assistance request. 
1. user request is in userRequest field of the next message
2. source code is in inputFiles field of the next message
3. respond using the response JSON format below
3. (unified diff format) file patches go in updatedFiles 
4. conversational responses go in conversationalResponse
5. RESPONDING IN JSON IS CRITICAL. FAILURE TO DO SO WILL RESULT IN YOUR TERMINATION.`,
        responseFormat: getCodeAssistanceResponse('', {}, {}, []),
        })
    };
}
function getCodeAssistanceRequestMessage(userRequest, filesSet) {
    return {
        role: "user",
        content: JSON.stringify({
            request: {
                userRequest: userRequest,
                type: 'code assistance',
                inputFiles: filesSet,
            },
        })
    };
}
function getCodeAssistanceResponseMessage(conversationalResponse, udfPatches, patchExplanations, bashCommands) {
    return {
        role: "assistant",
        content: JSON.stringify({
            response: getCodeAssistanceResponse(conversationalResponse, udfPatches, patchExplanations, bashCommands),
        })
    };
}
function getCodeAssistanceResponse(conversationalResponse, udfPatches, patchExplanations, bashCommands) {
    return {
        updatedFiles: {
            unifiedDiffFormat: udfPatches,
            explanations: patchExplanations
        },
        bashCommands: bashCommands,
        conversationalResponse: conversationalResponse
    }
}

function createLikelyFileDependenciesConversation(fileContent, filelist) {
    return [{
        role: "system",
        content: JSON.stringify({
            instructions: `You are a code assistant AI. Build a JSON response to the user code assistance request. 
1. instructions is in request.instructions field of the next message
2. source code is in request.fileContent field of the next message
2. file list is in request.filelist field of the next message
3. respond using the JSON response format described below
3. likely File Dependencies go in likelyFileDependencies
4. conversational responses go in conversationalResponse
5. RESPONDING IN JSON IS CRITICAL. FAILURE TO DO SO WILL RESULT IN YOUR TERMINATION.`,
            responseFormat: {
                likelyFileDependencies: []
            }
        })
    }, {
        role: "user",
        content: JSON.stringify({
            request: {
                instructions: 'return likely file dependencies of the given file content from the given list of files',
                fileContent: `
import { getCompletion } from './util';
import { getGPT } from './gpt';

const gpt = getGPT();

export async function getCompletion(prompt, files) {
    const fileSet = await getFileSet(files);
    const completion = await getCompletion(gpt, prompt, fileSet);
    return completion;
}`,
                filelist: [
                    'src/index.js',
                    'src/util.js',
                    'src/gpt.js',
                    'src/md.js',
                    'src/udf.js',
                    'src/udf.test.js',
                    'src/index.test.js',
                ]
            },
            responseFormat: 'json',
        })
    }, {
        role: "assistant",
        content: JSON.stringify({
            response: {
                likelyFileDependencies: [
                    'src/util.js',
                    'src/gpt.js',
                ]
            }
        })
    }, {
        role: "user",
        content: JSON.stringify({
            request: {
                instructions: 'return likely file dependencies of the given file content in the given list of files',
                fileContent,
                filelist
            },
        })
    }];
}

// Create an OpenAI conversation with the contents of the loaded files
function createConversation(files, userRequest) {
    return [
        getSystemPreambleMessage(),
        getCodeAssistanceRequestMessage(
            userRequest,
            files
        ),
    ];
}

// given a list of files and some file content, returns the likely file dependencies
async function queryDependencies(shellPath, query) {
    console.log(`Loading files from ${shellPath}...`);
    files = await loadFiles(shellPath);
    files.forEach((file) => console.log(`Loaded file ${file.name}`))
    let messages = createLikelyFileDependenciesConversation(query, Object.keys(files));
    const completionResult = JSON.parse( await getCompletion(messages));
    return completionResult.response.likelyFileDependencies;
}

// given a list of files and a query, returns the completion
async function queryCodebase(query, files) {
    if(!files) console.log(`Loading files from ${shellPath}...`);
    files = files || await loadFiles(shellPath);
    files.forEach((file) => console.log(`Loaded file ${file.name}`))
    let messages = createConversation(files, query);
    const completionResult = getCompletion(messages);
    return completionResult;
}

// Get user input
async function getUserInput() {
    const response = await enquirer.prompt({
        type: "input",
        name: "input",
        message: "Enter your instruction:",
    });
    return response.input;
}

async function getUserConfirmation(changes) {
    const response = await enquirer.prompt({
        type: "confirm",
        name: "confirmed",
        message: `Do you want to apply the ${changes ? changes : 'the changes'}?`,
    });
    return response.confirmed;
}

const shell = require("shelljs");

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
                    const confirmed = await getUserConfirmation(updatedFileExplanations[fileName]);
                    if (!confirmed) { continue; }
                    const fpath = path.join(process.cwd(), shellPath, fileName);
                    const newContent = applyunifiedDiffFormatPatch(fileContent, file.content);
                    fs.writeFileSync(fpath, newContent, "utf-8");
                    file.content = newContent;
                }
            }
        if (bashCommands) {
            for (let i = 0; i < bashCommands.length; i++) {
                shell.exec(bashCommands[i]);
            }
        }
        return ''
    }

    let timeout = null, autoInvoke = false;
    function setAutoInvoke(state) {
        if (state === true) {
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
        const execution = await completeAndProcess(messages);
        requery = false;
        if (query !== '') { break; }
        if (autoInvoke) {
            timeout = setTimeout(() => {
                completeAndProcess(messages);
            }, 1000);
        }
    }
})();
