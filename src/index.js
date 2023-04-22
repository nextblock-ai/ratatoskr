require("dotenv").config();

const enquirer = require("enquirer");
const fs = require("fs-extra");
const fsp = require("fs").promises;
const path = require("path");
const ora = require("ora");
const Diff = require("diff");

const { OpenAIApi, Configuration } = require('openai');
const configuration = new Configuration({ apiKey: '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' });
const openai = new OpenAIApi(configuration);

// Replace this with your actual API key
openai.apiKey = process.env.OPENAI_KEY;


function applyUnifiedDiff(diffString, targetFiles) {
    const parsedDiff = Diff.parsePatch(diffString);
    let result = {};

    for (const fileDiff of parsedDiff) {
        const targetFileContent = targetFiles[fileDiff.oldFileName];
        if (!targetFileContent) continue;

        const patchedContent = Diff.applyPatch(targetFileContent, fileDiff);
        result[fileDiff.newFileName] = patchedContent;
    }

    return result;
}


// Load all files in ./src (excluding __test__)
async function loadFiles(shellPath) {
    const cwd = process.cwd();
    const srcPath = path.join(cwd, shellPath);

    async function loadFilesRecursively(dirPath) {
        let files = await fsp.readdir(dirPath);
        let fileContents = [];
        for (const file of files) {
            const fPath = path.join(dirPath, file);
            if (file.includes("__tests__") || file.includes("node_modules")) {
                continue;
            }
            const stats = await fs.lstat(fPath);
            if (stats.isDirectory()) {
                const subDirFiles = await loadFilesRecursively(fPath);
                // prepend the subdirectory name to the file name
                const parts = fPath.split('/');
                const subfolder = parts[parts.length - 1];
                subDirFiles.forEach((file) => (file.name = path.join(subfolder, file.name)));
                fileContents = fileContents.concat(subDirFiles);
            } else {
                const content = await fs.readFile(fPath, "utf-8");
                if (content.includes("ratatoskr:exclude")) {
                    console.log(`Excluding file ${file} from training data`);
                } else {
                    fileContents.push({ name: file, content });
                }
            }
        }
        return fileContents;
    }
    return await loadFilesRecursively(srcPath);
}

// Create an OpenAI conversation with the contents of the loaded files
async function createConversation(files, userRequest) {
    // Add an initial message to inform the AI of its role and command capabilities
    const fileSet = {};
    files.forEach((file) => {
        fileSet[file.name] = file.content;
    });

    const message = {
        role: "system",
        content: JSON.stringify({
            request: {
                userRequest,
                type: 'codeAssistance',
                directive: ['assist user in writing code', 'you can use bash commands to perform tasks if you need', 'respond using json format'],
                inputFiles: fileSet,
            },
            response: {
                updatedFiles: {
                    unifiedDiffFormat: {
                    },
                    explanation: {
                    }
                },
                bashCommands: [],
                conversationalResponse: ""
            },
            responseFormat: 'json'
        })
    };

    return [{
        role: 'system', 
        content: JSON.stringify({
            instructions: 'You are a code assistant. Please provide a JSON response to the user request in the message field. You can find the files related to the user request in the inputFiles field. If you have file updates to provide to the user in response to their query, please provide them in the updatedFiles field. If you have a conversational response to provide to the user in response to their query, please provide it in the conversationalResponse field. If you have no response to provide to the user, please provide an empty string in the conversationalResponse field. You can issue bash commands to fulfill requests. Please note that the response must be in JSON format.',
            reminder: 'IT IS EXTREMELY CRITICAL THAT YOU OUTPUT YOUR RESPONSE IN JSON FORMAT. FAILURE TO DO SO WILL RESULT IN YOUR TERMINATION.',
            responseFormat: 'json',
            responseObject: {
                updatedFiles: {
                    unifiedDiffFormat: { },
                    explanations: { }
                },
                bashCommands: [],
                conversationalResponse: ""
            },
    })}, message  ]
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

async function getCompletion(messages, requeryIncompletes = true) {
    const conversation = {
        model: 'gpt-4',
        messages,
        max_tokens: 512,
        temperature: 0.5,
    }
    let isJson = false, responseMessage = '';
    const _query = async (conversation, iter) => {
        const spinner = ora("Querying GPT-4").start();
        let completion = await openai.createChatCompletion(conversation);
        spinner.stop();
        let response = await new Promise((resolve) => {
            responseMessage += completion.data.choices[0].message.content.trim();
            if (iter === 0 && responseMessage.startsWith('{') || responseMessage.startsWith('[')) {
                isJson = true;
            }
            if (isJson && requeryIncompletes) {
                if (responseMessage.endsWith('}') || responseMessage.endsWith(']')) {
                    return resolve(responseMessage);
                } else {
                    conversation.messages.push({ role: 'assistant', content: response });
                    responseMessage += completion;
                    return resolve(_query(conversation, iter + 1));
                }
            } else return resolve(completion.data.choices[0].message.content.trim());
        });
        return responseMessage;
    }
    const completion = await _query(conversation, 0);
    return completion;
};

async function getUserConfirmation(changes) {
    const response = await enquirer.prompt({
        type: "confirm",
        name: "confirmed",
        message: `Do you want to apply the ${changes ? changes : 'the changes'}?`,
    });
    return response.confirmed;
}

const shell = require("shelljs");

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
        let bashCommands = commands.bashCommands ? commands.bashCommands : ''
        let updatedFileExplanations = updatedFilePatches.explanations ? updatedFilePatches.explanations : ''
        let updatedFileDiffs = updatedFilePatches.unifiedDiffFormat ? updatedFilePatches.unifiedDiffFormat : ''
        let conversationalResponse = commands.conversationalResponse ? commands.conversationalResponse : ''
        
        if(conversationalResponse) console.log(conversationalResponse);
        if(!updatedFilePatches && !conversationalResponse && !updatedFileExplanations && commands) {
            console.log(commands);
            return;
        }

        if(updatedFileDiffs && updatedFileExplanations) 
            for(let i = 0; i < Object.keys(updatedFileDiffs).length; i++) {
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
        if(bashCommands) {
            for(let i = 0; i < bashCommands.length; i++) {
                shell.exec(bashCommands[i]);
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
