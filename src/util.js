require("dotenv").config();

const enquirer = require("enquirer");
const fs = require("fs-extra");
const fsp = require("fs").promises;
const path = require("path");
const ora = require("ora");

const { OpenAIApi, Configuration } = require('openai');
const configuration = new Configuration({ apiKey: process.env.OPENAI_KEY });
const openai = new OpenAIApi(configuration);


function applyUnifiedDiff(patch, content) {
    if (!patch || !content) {
        return {
            error: 'Patch or content is empty',
            patchedContent: content,
            metadata: {},
        };
    }

    const contentLines = content.split(/\r?\n/);
    const patchLines = patch.split(/\r?\n/);
    let patchedContent = '';
    let metadata = {};

    let contentIndex = 0;
    let patchIndex = 0;

    try {
        while (patchIndex < patchLines.length) {
            const patchLine = patchLines[patchIndex];

            if (patchLine.startsWith('diff')) {
                metadata.diff = patchLine;
                patchIndex++;
            } else if (patchLine.startsWith('index')) {
                metadata.index = patchLine;
                patchIndex++;
            } else if (patchLine.startsWith('---')) {
                metadata.fileA = patchLine;
                patchIndex++;
            } else if (patchLine.startsWith('+++')) {
                metadata.fileB = patchLine;
                patchIndex++;
            } else if (patchLine.startsWith('@@')) {
                const [startIndex, length] = patchLine
                    .match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
                    .slice(1)
                    .map(Number);

                patchedContent += contentLines.slice(contentIndex, startIndex - 1).join('\n') + '\n';
                contentIndex = startIndex - 1;
                patchIndex++;
            } else if (patchLine.startsWith('-')) {
                contentIndex++;
                patchIndex++;
            } else if (patchLine.startsWith('+')) {
                patchedContent += patchLine.slice(1) + '\n';
                patchIndex++;
            } else {
                patchedContent += contentLines[contentIndex] + '\n';
                contentIndex++;
                patchIndex++;
            }
        }
        patchedContent += contentLines.slice(contentIndex).join('\n');

        return {
            patchedContent,
            metadata,
        };
    } catch (error) {
        return {
            error: 'An error occurred while applying the patch: ' + error.message,
            patchedContent: content,
            metadata: {},
        };
    }
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
        max_tokens: 2048,
        temperature: 0.6,
    }
    const _response = [];
    const _getResponse = () => _response.join('');
    const _isResponseJson = () => _getResponse().startsWith('{') || _getResponse().startsWith('[');
    const _isProperlyFormedJson = () => _isResponseJson() && (_getResponse().endsWith('}') || _getResponse().endsWith(']'));
    let isJson = false;

    const _query = async (conversation, iter) => {

        let completion = await openai.createChatCompletion(conversation);
        completion = completion.data.choices[0].message.content.trim();
        _response.push(completion);
        
        return new Promise((resolve) => {
            const responseMessage = _getResponse();
            isJson = iter === 0 && _isResponseJson();
            if (isJson && requeryIncompletes) {
                if (_isProperlyFormedJson()) {
                    return resolve(responseMessage);
                } else {
                    conversation.messages.push({ role: 'assistant', content: completion });
                    return resolve(_query(conversation, iter + 1));
                }
            } else return resolve(responseMessage);
        });
    }
    const completion = await _query(conversation, 0);
    return completion;
};

module.exports = {
    applyUnifiedDiff,
    loadFiles,
    getCompletion
};