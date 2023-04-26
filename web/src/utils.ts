import "dotenv/config";
import path from "path";
import fs from "fs";
import shell from "shelljs";
import { createConversation, queryDependencies, queryIsAdditionalInformationRequired } from "./prompt";
import { jsonrepair } from 'jsonrepair';
import { getCompletion } from "./gpt";
import config from "../config";


export function applyUnifiedDiff(patch: string, content: string) {
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
    let metadata = {
        diff: '',
        index: '',
        fileA: '',
        fileB: '',
    };
    let contentIndex = 0;
    let patchIndex = 0;
    try {
        while (patchIndex < patchLines.length) {
            const patchLine = patchLines[patchIndex];
            if(patchLine === null) continue;
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
                const  pl = patchLine
                    .match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
                if(!pl) continue;
                const [startIndex, length] = pl
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
    } catch (error: any) {
        return {
            error: 'An error occurred while applying the patch: ' + error.message,
            patchedContent: content,
            metadata: {},
        };
    }
}


export async function loadFiles(shellPath: any) {
    const srcPath = path.join(shellPath);
    function loadFilesRecursively(dirPath: any) {
        let files = fs.readdirSync(dirPath);
        let fileContents: any[] = [];
        for (const file of files) {
            const fPath = path.join(dirPath, file);
            const ignorableFilesAndFolders = ["__tests__", "node_modules", ".git", ".next", "package.json", "package-lock.json", "yarn.lock", "tsconfig.js", "tsconfig.build.json", "next.config.js", "next-env.d.ts", "README.md", "LICENSE", "Dockerfile", "docker-compose.yml" ];
            if (ignorableFilesAndFolders.includes(file)) continue;
            const stats = fs.lstatSync(fPath);
            if (stats.isDirectory()) {
                const subDirFiles = loadFilesRecursively(fPath);
                // prepend the subdirectory name to the file name
                const parts = fPath.split('/');
                const subfolder = parts[parts.length - 1];
                subDirFiles.forEach((file: { name: any; }) => (file.name = path.join(subfolder, file.name)));
                fileContents = fileContents.concat(subDirFiles);
            } else {
                const content = fs.readFileSync(fPath, "utf-8");
                fileContents.push({ name: file, content });
            }
        }
        return fileContents;
    }
    return loadFilesRecursively(srcPath);
}


export async function completeAndProcess(userInput: string) {
    const shellPath = config.path;
    const files = await loadFiles(shellPath);
    const gatherLikelyDependencies = async (userInput: string) => {
        let loadedFiles: any = {};
        let fileDeps = await queryDependencies(
            shellPath,
            userInput,
        );
        // go through the files and add the dependencies to the loadedFiles object
        for(let j = 0; j < fileDeps.length; j++) {
            const fileDep = fileDeps[j];
            loadedFiles[fileDep] = files.find((file: { name: any }) => file.name === fileDep).content;
        }
        return loadedFiles;
    }
    let working = true, aiResponse: any = {};
    while(working) {
        // here we need to get the likely dependencies
        let loadedFiles = await gatherLikelyDependencies(userInput);
        console.log('likely dependencies', Object.keys(loadedFiles));   
        // here we try to do the actual completion
        const messages = createConversation(loadedFiles, userInput);
        const completion = await getCompletion(messages);
        // we parse the completiob and get response
        let commands = JSON.parse(jsonrepair(completion));
        if (commands.response) commands = commands.response;
        
        // we get all the parts of the response
        let updatedFilePatches = commands.updatedFiles ? commands.updatedFiles : ''
        let bashCommands = commands.bashCommands ? commands.bashCommands : ''
        let updatedFileExplanations = updatedFilePatches.explanations ? updatedFilePatches.explanations : ''
        let updatedFileDiffs = updatedFilePatches.unifiedDiffFormat ? updatedFilePatches.unifiedDiffFormat : ''
        let conversationalResponse = commands.conversationalResponse ? commands.conversationalResponse : ''
        
        // we create the response object
        aiResponse = {
            bashCommands,
            updatedFileExplanations,
            updatedFileDiffs,
            conversationalResponse,
        }
        // we query to see if we need more information - usually we might need to add more files
        const result = await queryIsAdditionalInformationRequired(userInput, aiResponse);
        // if additional information is required, we add it to the userInput and loop again
        if(result.additionalInformationRequired) {
            userInput = userInput += '\nThese files are also needed: ' + result.additionalFiles;
            console.log(userInput)
        } else {
            // if not, we are done!
            working = false;
        }
    }
    await commitCompletion(aiResponse);
    return aiResponse;
}

export async function commitCompletion( {
    bashCommands,
    updatedFileExplanations,
    updatedFileDiffs,
}: any) {
    const shellPath = config.path;
    const files = await loadFiles(shellPath);
    let results = [];
    if (updatedFileDiffs && updatedFileExplanations)
        for (let i = 0; i < Object.keys(updatedFileDiffs).length; i++) {
            let fileName = Object.keys(updatedFileDiffs)[i];
            let fileContent = updatedFileDiffs[fileName]
            const file = files.find((f: { name: string; }) => f.name.endsWith(fileName));
            if (file) {
                const fpath = path.join(config.path, fileName);
                const newContent = applyUnifiedDiff(fileContent, file.content);
                if(!newContent.error && newContent.patchedContent) {
                    fs.renameSync(fpath, fpath + '.bak')
                    fs.writeFileSync(fpath, newContent.patchedContent, "utf-8");
                    file.content = newContent.patchedContent;
                    results.push(`file ${fileName} updated`);
                } else {
                    results.push(`error: ${newContent.error}`);
                }
            }
        }
    let consoleUpdates = [];
    if (bashCommands) {
        for (let i = 0; i < bashCommands.length; i++) {
            const { stdout, stderr, code } = shell.exec(bashCommands[i]);
            if(stdout) consoleUpdates.push(`stdout (${code}): ${stdout}`);
            if(stderr) consoleUpdates.push(`stderr (${code}): ${stderr}`);
        }
    }
    return {
        fileUpdates: results,
        consoleUpdates,
    }
}