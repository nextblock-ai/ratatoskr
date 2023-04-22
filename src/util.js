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


async function getCompletion(messages, requeryIncompletes = true) {
    const conversation = {
        model: 'gpt-4',
        messages,
        max_tokens: 1024,
        temperature: 0.01,
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

module.exports = {
    applyUnifiedDiff,
    applyunifiedDiffFormatPatch,
    loadFiles,
    getCompletion
};