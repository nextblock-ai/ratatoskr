import { jsonrepair } from "jsonrepair";
import { getCompletion } from "./gpt";
import { createConversation, queryDecompose, queryDependencies, queryIsAdditionalInformationRequired } from "./prompt";
import { applyUnifiedDiff, loadFiles } from "./utils";
import shell from "shelljs";
import path from "path";
import fs from "fs";
import * as config from "../config.json";

// given a list of files and a user input, returns the likely dependencies
const gatherLikelyDependencies = async (shellPath: string, files: any, userInput: string) => {
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

// given a list of files and a user input, returns whether additional information is required
const decomposeTask = async (shellPath: string, userInput: string) => {
    // get the decomposition for the user tasks - this is the specific speps to complete the task
    let tasks = await queryDecompose(
        shellPath,
        userInput,
    );
    return tasks;
}

// given a list of files and a user input, returns whether additional information is required
export async function commandLoop(userInput: string) {

    // get the working directory, and load the files
    const shellPath = config.path
    const files = await loadFiles(shellPath);

    // decompose the task into subtasks
    const decomposedTasks = await decomposeTask(shellPath, userInput);
    let currentTaskIndex = 0;
    function getCurrentTask() {
        const tasks = []; // include previous tasks as complete
        for(let i = 0; i <= currentTaskIndex; i++) {
            const dtask = i < decomposedTasks.length ? decomposedTasks[i] : userInput;
            const task = (i === currentTaskIndex) ? 'YOUR CURRENT TASK IS: ' + dtask : dtask + ' (complete)';
            tasks.push(task);
        }
        return 'USER REQUEST:\n\n' + userInput + '\n\nTASKS TO COMPLETE USER REQUEST:\n\n' + (tasks.join('\n') || userInput);
    }

    let working = true,  steps = [];

    while(working) {
        // get the current task - this packages the main request and the subtasks together
        let currentTask = getCurrentTask();
        console.log('current task', currentTask);

        // here we need to get the likely dependencies for the current tassk
        let loadedFiles = await gatherLikelyDependencies(shellPath, files, currentTask);
        const likelyDeps = 'Gathered likely dependencies: ' + Object.keys(loadedFiles).join(', ');
        steps.push(likelyDeps);
        console.log('likely dependencies', likelyDeps);
        
        // here we try to do the actual completion
        const messages = createConversation(loadedFiles, currentTask);
        const completion = await getCompletion(messages);
        
        // we parse the completion and get response
        let commands = JSON.parse(jsonrepair(completion));
        if (commands.response) commands = commands.response;
        
        // we get all the parts of the response
        let updatedFilePatches = commands.updatedFiles ? commands.updatedFiles : ''
        let bashCommands = commands.bashCommands ? commands.bashCommands : ''
        let updatedFileExplanations = updatedFilePatches.explanations ? updatedFilePatches.explanations : ''
        let updatedFileDiffs = updatedFilePatches.unifiedDiffFormat ? updatedFilePatches.unifiedDiffFormat : ''
        let conversationalResponse = commands.conversationalResponse ? commands.conversationalResponse : ''

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
                    steps.push(`file ${fileName} updated`);
                } else {
                    steps.push(`error: ${newContent.error}`);
                }
            }
        }

        steps.push(`Updated files: ${Object.keys(updatedFileExplanations).join(', ')}`);
        steps.push(`Updated file diffs: ${Object.keys(updatedFileDiffs).join(', ')}`);
        steps.push(`Bash commands: ${bashCommands.join(', ')}`);
        steps.push(`Conversational response: ${conversationalResponse}`);

        if (bashCommands) {
            for (let i = 0; i < bashCommands.length; i++) {
                console.log('BASH', bashCommands[i])
                steps.push(`Bash command: ${bashCommands[i]}`);
                const { stdout, stderr, code } = shell.exec(bashCommands[i]);
                if(stdout) steps.push(`stdout (${bashCommands[i]}): ${stdout}`);
                if(stderr) steps.push(`stderr (${bashCommands[i]}): ${stderr}`);
            }
        }

        // we append the current task to the steps
        currentTask = currentTask + '\n\n' + steps.join('\n\n'); 
        
        // we query to see if we need more information - usually we might need to add more files
        const result = await queryIsAdditionalInformationRequired(currentTask, {
            updatedFileExplanations,
            updatedFileDiffs,
            currentTask
        });
        
        // if additional information is required, we add it to the userInput and loop again
        if(result.additionalInformationRequired) {
            currentTask = currentTask += '\nThese files are also needed: ' + result.additionalFiles;
            console.log(currentTask)
        } else {
            // if not, we are done!
            currentTaskIndex++
            if(currentTaskIndex >= decomposedTasks.length) working = false;
        }
    }
}

export async function commitCompletion( {
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
    return {
        fileUpdates: results,
    }
}