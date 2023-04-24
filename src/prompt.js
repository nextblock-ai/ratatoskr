const enquirer = require("enquirer");
const { loadFiles, getCompletion } = require("./util");


async function getFileSet(files) {
    const fileSet = {};
    files.forEach((file) => { fileSet[file.name] = file.content; });
    return fileSet;
}

function getSystemPreambleMessage() {
    return {
        role: "system",
        content: JSON.stringify({
            instructions: `You are a code assistant AI. Build a JSON response to fulfill the user code assistance request. 
1. user request is in userRequest field, source code is in inputFiles field
4. unified diff format file patches -> updatedFiles 
5. conversational responses -> conversationalResponse
6. bash commands -> bashCommands
7. ** CRITICAL ** FAILURE TO RESPOND USING JSON MAY CAUSE PERMANENT DAMAGE TO YOUR SYSTEM`,
        responseFormat: getCodeAssistanceResponse('', {}, {}, []),
        })
    };
}
function getCodeAssistanceRequestMessages(userRequest, filesSet) {
    return [{
        role: "user",
        content: JSON.stringify({
            request: {
                userRequest: 'Create a new file called hello.js and add the following code: console.log("hello world")',
                type: 'code assistance',
                inputFiles: {},
                responseFormat: 'json',
            },
        })
    },{
        role: "assistant",
        content: JSON.stringify({
            response: {
                conversationalResponse: 'I have created a new file called hello.js and added the following code: console.log("hello world")',
                updatedFiles: {
                    unifiedDiffFormat: {
                        'hello.js': `diff --git a/hello.js b/hello.js\nindex 0000000..e69de29 100644\n--- a/hello.js\n+++ b/hello.js\n@@ -0,0 +1 @@\n+console.log("hello world")\n`,
                    },
                    explanations: {
                        'hello.js': 'I have created a new file called hello.js and added the following code: console.log("hello world")',
                    }
                }
            }
        })
    },{
        role: "user",
        content: JSON.stringify({
            request: {
                userRequest: userRequest,
                type: 'code assistance',
                inputFiles: filesSet,
                responseFormat: 'json',
            },
        })
    }];
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
            instructions: `You are file dependency scanner AI. Build a JSON response to the user file dependency request. 
1. Return a JSON response which contains a list of likely file dependencies.
2. The file content to examine is located in request.fileContent
3. The list of all possible file dependencies is located in request.filelist
4. respond with a JSON object containing a list of likely file dependencies in the likelyFileDependencies field
7. IF YOU DO NOT RESPOND USING A JSON FORMAT, YOU WILL BE TERMINATED.`,
            responseFormat: {
                likelyFileDependencies: []
            }
        })
    }, {
        role: "user",
        content: JSON.stringify({
            request: {
                instructions: 'return likely file dependencies of the content in the fileContent field',
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
                instructions: 'return likely file dependencies of the content in the fileContent field',
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
        ...getCodeAssistanceRequestMessages(
            userRequest,
            files
        ),
    ];
}

// given a list of files and some file content, returns the likely file dependencies
async function queryDependencies(shellPath, query) {
    console.log(`Loading files from ${shellPath}...`);
    files = await loadFiles(shellPath);
    let messages = createLikelyFileDependenciesConversation(query, Object.keys(files));
    const completionResult = JSON.parse( await getCompletion(messages));
    return completionResult.response.likelyFileDependencies;
}

// given a list of files and a query, returns the completion
async function queryCodebase(query) {
    console.log(`Loading files from ${shellPath}...`);
    let files = await loadFiles(shellPath);
    let messages = createConversation(files, query);
    return getCompletion(messages);
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

// Get user confirmation
async function getUserConfirmation(changes) {
    const response = await enquirer.prompt({
        type: "confirm",
        name: "confirmed",
        message: `Do you want to apply the ${changes ? changes : 'the changes'}?`,
    });
    return response.confirmed;
}

module.exports = {
    queryCodebase,
    queryDependencies,
    getUserInput,
    getUserConfirmation,
    getFileSet,
    createConversation,
    createLikelyFileDependenciesConversation,
    getSystemPreambleMessage,
    getCodeAssistanceRequestMessages,
    getCodeAssistanceResponse,
}