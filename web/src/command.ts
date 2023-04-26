import { jsonrepair } from "jsonrepair";
import { getCompletion } from "./gpt";
import { createConversation, queryDecompose, queryDependencies, queryIsAdditionalInformationRequired } from "./prompt";
import { applyUnifiedDiff, loadFiles } from "./utils";
import shell from "shelljs";
import path from "path";
import fs from "fs";
import config from "../config.json";

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
    return JSON.parse(tasks);
}

// given a list of files and a user input, returns whether additional information is required
export async function commandLoop(userInput: string, resp: any, onUpdate: any) {

    onUpdate(`Received command: ${userInput}`);

    // get the working directory, and load the files
    const shellPath = config.path
    process.chdir(shellPath);

    const files = await loadFiles(shellPath);
    onUpdate(`Loaded ${files.length} files from ${shellPath}`);

    // // decompose the task into subtasks
    let decomposedTasks = await decomposeTask(shellPath, userInput);
    decomposedTasks = decomposedTasks.map((t: any)=>({
        task: t.action,
        command: t.shell_command,
    }));
    onUpdate('Decomposed tasks: ' + decomposedTasks.map((t:any)=>(`${t.command}: ${t.action}`)).join('\n'));

    let currentTaskIndex = 0;
    function getCurrentTask() {
        const decomposedTaskStrings = decomposedTasks.map((t:any)=>(`${t.command}: ${t.action}`));
        // get the decomposed tasks up to the last one not including the current task
        const dtasks = decomposedTaskStrings.slice(0, currentTaskIndex).map((t:any)=>`${t} (complete)`).join('\n');
        // get the current task
        const currentTask = decomposedTaskStrings[currentTaskIndex] + ' (incomplete)';
        return `USER REQUEST:
        
${userInput}

COMPLETED TASKS:  ${dtasks || userInput}
CURRENT TASK:  ${currentTask}
`
    }

    let working = true

    while(working) {
        const steps = [];
        // get the current task - this packages the main request and the subtasks together
        let currentTask = getCurrentTask();
        onUpdate(`current task: ${currentTask}`);
        console.log('current task', currentTask);

        // here we need to get the likely dependencies for the current tassk
        let loadedFiles = await gatherLikelyDependencies(shellPath, files, currentTask);
        const likelyDeps = 'Gathered likely dependencies: ' + Object.keys(loadedFiles).join(', ');
        
        steps.push(likelyDeps);
        onUpdate('likely dependencies: '  + likelyDeps);
        console.log('likely dependencies', likelyDeps);
        
        // here we try to do the actual completion
        const messages = createConversation(loadedFiles, currentTask);
        const completion = await getCompletion(messages);
        onUpdate('completion: '+ completion);
        
        // we parse the completion and get response
        let commands = JSON.parse(jsonrepair(completion));
        if (commands.response) commands = commands.response;
        
        console.log('commands', commands);

        // we get all the parts of the response
        let updatedFilePatches = commands.updatedFiles ? commands.updatedFiles : ''
        let bashCommands = commands.bashCommands ? commands.bashCommands : ''
        let updatedFileExplanations = updatedFilePatches.explanations ? updatedFilePatches.explanations : ''
        let updatedFileDiffs = updatedFilePatches.unifiedDiffFormat ? updatedFilePatches.unifiedDiffFormat : ''
        let conversationalResponse = commands.conversationalResponse ? commands.conversationalResponse : ''
        let taskCompleted = commands.taskCompleted ? commands.taskCompleted : true

        let consoleOutput = '';
        if (bashCommands) {
            for (let i = 0; i < bashCommands.length; i++) {
                steps.push(`Bash command: ${bashCommands[i]}`);
                onUpdate('bash command: ' + bashCommands[i], );
                const { stdout, stderr, code } = shell.exec(bashCommands[i]);
                if(stdout) steps.push(`stdout (${bashCommands[i]}): ${stdout}`);
                if(stderr) steps.push(`stderr (${bashCommands[i]}): ${stderr}`);
                consoleOutput += stdout + '\n' + stderr + '\n';
            }
        }
        console.log('BASH', consoleOutput)

        // we append the current task to the steps
        currentTask = currentTask + '\n\n' + steps.join('\n\n'); 
        conversationalResponse += '\n\n' + consoleOutput;

        onUpdate('console output', conversationalResponse);

        if (updatedFileDiffs)
            for (let i = 0; i < Object.keys(updatedFileDiffs).length; i++) {
                let fileName = Object.keys(updatedFileDiffs)[i];
                let fileContent = updatedFileDiffs[fileName]
                const file = files.find((f: { name: string; }) => f.name.includes(fileName));
                if (file) {
                    const fpath = path.join(config.path, fileName);
                    const newContent = applyUnifiedDiff(fileContent, file.content);
                    if(!newContent.error && newContent.patchedContent) {
                        fs.renameSync(fpath, fpath + '.bak')
                        fs.writeFileSync(fpath, newContent.patchedContent, "utf-8");
                        file.content = newContent.patchedContent;
                        steps.push(`file ${fileName} updated`);
                        onUpdate(`file ${fileName} updated`, conversationalResponse);
                    } else {
                        steps.push(`error: ${newContent.error}`);
                        onUpdate('error', newContent.error);
                    }
                }
            }

        if(!updatedFileDiffs && taskCompleted) {
            // we move on to the next task
            currentTaskIndex++;
            onUpdate('task completed', conversationalResponse);
            console.log('task completed', conversationalResponse);

            if(currentTaskIndex >= decomposedTasks.length) {
                // we are done
                working = false;
                onUpdate('request completed: ' + conversationalResponse);
                console.log('request completed', conversationalResponse);
                resp.close();
                return true;
            }
        }

        steps.push(`Updated files: ${Object.keys(updatedFileExplanations).join(', ')}`);
        steps.push(`Updated file diffs: ${Object.keys(updatedFileDiffs).join(', ')}`);
        steps.push(`Conversational response: ${conversationalResponse}`);

        onUpdate('updated files ' + Object.keys(updatedFileExplanations).join(', '));
        onUpdate('updated file diffs ' + Object.keys(updatedFileDiffs).join(', '));
        onUpdate('conversational response' + conversationalResponse);

        
        // if additional information is required, we add it to the userInput and loop again
        if(!taskCompleted) {
             // we query to see if we need more information - usually we might need to add more files
            const result = await queryIsAdditionalInformationRequired(currentTask, {
                updatedFileExplanations,
                updatedFileDiffs,
                currentTask
            });

            currentTask = currentTask += '\nThese files are also needed: ' + result.additionalFiles;
            onUpdate('additional files needed', result.additionalFiles);
        } else {
            // if not, we are done!
            currentTaskIndex++
            if(currentTaskIndex >= decomposedTasks.length) {
                working = false;
                onUpdate('task complete', 'task complete');
                resp.close();
                return 'task complete';
            }
            onUpdate('task complete', currentTask);
        }
    }
}


/*

Categories of operations:

1. File operations
2. Bash operations
3. Conversational operations
4. Informational operations

The Loop:

1. Get the current task
2. Get the likely dependencies for the current task
3. Try to do the actual completion
4. Parse the completion and get response
5. Get all the parts of the response
6. If there are file operations, apply them
7. If there are bash operations, execute them
8. If there are conversational operations, execute them
9. If there are informational operations, execute them
10. If there are additional files needed, add them to the current task and loop again


Proposed Update:

1. Get the current task
2. Get the likely dependencies for the current task
3. Try to do the actual completion
4. Parse the completion and get response
5. Get all the parts of the response
6. If there are file operations, apply them
7. If there are bash operations, execute them
8. If there are conversational operations, execute them
9. If there are informational operations, execute them
10. If there are additional files needed, add them to the current task and loop again



*/