import { loadFiles } from './utils';
import { getCompletion } from './gpt';

export async function getFileSet(files: any) {
    const fileSet: any = {};
    files.forEach((file: any) => { fileSet[file.name] = file.content; });
    return fileSet;
}

export function getSystemPreambleMessage() {
    return {
        role: "system",
        content: JSON.stringify({
            instructions: `You are a code assistant AI. Build a JSON response to fulfill the user code assistance request. 
1. user request is in userRequest field, source code is in inputFiles field
4. unified diff format file patches -> updatedFiles 
5. conversational responses -> conversationalResponse
6. bash commands -> bashCommands
7. ** CRITICAL ** FAILURE TO RESPOND USING JSON MAY CAUSE PERMANENT DAMAGE TO YOUR SYSTEM`,
        responseFormat: getCodeAssistanceResponse('', {}, {}, [], false),
        })
    };
}
export function getCodeAssistanceRequestMessages(userRequest: any, filesSet: any) {
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
                    },
                },
                bashCommands: [
                    'touch hello.js',
                ],
                taskCompleted: true,
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
export function getCodeAssistanceResponse(conversationalResponse: string, udfPatches: {}, patchExplanations: {}, bashCommands: never, taskCompleted: boolean[]) {
    return {
        updatedFiles: {
            unifiedDiffFormat: udfPatches,
            explanations: patchExplanations
        },
        bashCommands: bashCommands,
        conversationalResponse: conversationalResponse,
        taskCompleted: taskCompleted,
    }
}
export function createLikelyFileDependenciesConversation(userRequest: any, filelist: string[]) {
    const instructions = `You return a JSON array of the files you are likely to need to look at to fix the following user request:\n\n\"${userRequest}\"\n\nThe list of all possible files to choose from is located in request.filelist\n\nrespond with a JSON object containing a list of the files you are likely to need to look at to fix the user request\n\nIF YOU DO NOT RESPOND USING A JSON FORMAT, YOU WILL BE TERMINATED:`;
    return [{
        role: "system",
        content: JSON.stringify({
            instructions,
            responseFormat: {
                requiredFormat: 'json',
                likelyFiles: []
            }
        })
    },{
        role: "user",
        content: JSON.stringify({
            request: {
                instructions,
                userRequest: `I am trying to fix a bug in the app, theres a problem calling gpt from the index.js file`,
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
                likelyFiles: [
                    'src/index.js',
                    'src/gpt.js',
                ]
            }
        })
    }, {
        role: "user",
        content: JSON.stringify({
            request: {
                instructions,
                filelist
            },
            responseFormat: 'json',
        })
    }];
}

function createAdditionalInformationRequiredConversation(responseData: any, userRequest: any) {
    const sampleRequest = "I am trying to fix a bug in the app, theres a problem calling gpt from the index.tsx file"
    const sampleData = {
        updatedFilePatches: {},
        bashCommands: [],
        updatedFileExplanations: {},
        updatedFileDiffs: {},
        conversationalResponse: 'I need to see the content of the files \'gpt.tsx\' and \'util.tsx\' to fix the bug',
    };
    const instructions = (ur: any, rd: any) => `You return a JSON object indicating whether or not the given task is complete. Given the following task:\n\n\"${ur}\"\n\nand the following processing data:\n\n${JSON.stringify(rd)}\n\ndetermine whether or not the task is complete, and also determine what additional information is required to complete the user request\n\nIF YOU DO NOT RESPOND USING A JSON FORMAT, YOU WILL BE TERMINATED:`;
    return [{
        role: "system",
        content: JSON.stringify({
            instructions: instructions(sampleRequest, sampleData),
            responseFormat: {
                requiredFormat: 'json',
                isComplete: false,
                additionalFiles: ''
            }
        })
    }, {
        role: "user",
        content: JSON.stringify({
            request: {
                instructions: instructions(sampleRequest, sampleData),
            },
            requiredFormat: 'json',
        })
    }, {
        role: "assistant",
        content: JSON.stringify({
            response: {
                isComplete: false,
                additionalFiles: 'src/gpt.tsx, src/util.tsx',
            },
        })
    },{
        role: "user",
        content: JSON.stringify({
            request: {
                instructions: instructions(userRequest, responseData),
            },
            responseFormat: 'json',
        })
    }]
}

function createDecomposeConversation(files: any, userRequest: any, useFileMap: boolean = false) {
    const filemap = files.reduce((acc: any, file: any) => {
        acc[file.name] = file.content;
        return acc;
    }, {});
    const requestWithFilemap = {
        userRequest,
        files: filemap
    }
    const requestWithFiles = {
        userRequest,
    }
    return [{
        role: "system",
        content: `You are a task decomposer who decomposes user-generated tasks related to a set of project filenames provided with the request into a series of implementation steps. Each implementation step must feature either an informational output necessary for the next step, a file update, or a question or communication to the user. If the implementation step can be expressed as a shell command, then do so.. OUTPUT YOUR DATA AS A JSON ARRAY ONLY USING THE FORMAT [ { "step": 1, "action": "...", "shell_command": "..." } ]`
    },{
        role: "user",
        content: JSON.stringify(
            useFileMap ? requestWithFilemap : requestWithFiles
        )
    }]
}

// Create an OpenAI conversation with the contents of the loaded files
export function createConversation(files: any, userRequest: any) {
    return [
        getSystemPreambleMessage(),
        ...getCodeAssistanceRequestMessages(
            userRequest,
            files
        ),
    ];
}

// given a list of files and some file content, returns the likely file dependencies
export async function queryDependencies(shellPath: string, query: any) {
    let files = await loadFiles(shellPath);
    files = files.map(file => file.name)
    let messages = createLikelyFileDependenciesConversation(query, files);
    const completionResult = JSON.parse( await getCompletion(messages));
    return completionResult.response.likelyFiles;
}

// given a list of files and a query, returns the completion
export async function queryCodebase(shellPath: any, query: any) {
    let files = await loadFiles(shellPath);
    let messages = createConversation(files, query);
    return getCompletion(messages);
}

export async function queryIsAdditionalInformationRequired(userInput: any, aiResponse: any) {
    let messages = createAdditionalInformationRequiredConversation(aiResponse, userInput);
    const completion = await getCompletion(messages)
    const result = JSON.parse( completion);
    return result.response;
}

export async function queryDecompose(shellPath: any,  query: any) {
    let files = await loadFiles(shellPath);
    let messages = createDecomposeConversation(files, query);
    return JSON.parse(await getCompletion(messages, {
        model: 'gpt-4',
        max_tokens: 2048,
        temperature: 0.6,
    }));
}
