import { jsonrepair } from "jsonrepair";
import { getCompletion } from "./gpt";
import { createConversation, queryDecompose, queryDependencies, queryIsAdditionalInformationRequired } from "./prompt";
import { applyUnifiedDiff, loadFiles } from "./utils";
import shell from "shelljs";
import path from "path";
import fs from "fs";
import config from "@/config";

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


export async function softwareDeveloper(query: any, path: string, maxIterations = 10, existingMessages = [], sseStream: any, onUpdate: any) {
    const log = (message: string) => {  onUpdate(message);  }
    const messages = existingMessages.length > 0 ? existingMessages : [{
        role: "system",
        content: `You are a master software developer skilled in bash commands, task decomposition, and app design and implementation. Given user input, you either implement the task in one-shot or you decompose the task then implement the sub-tasks.
1. No natural-language responses or commentary. ALL COMMANDS ON THEIR OWN LINE
2. Complete task, then output /TASK <taskname>.
3. ||Decompose tasks into bash commands||, output each task with [ ] preceeding it. Do not prefix bash commands with anything. 
4. Append /DECOMPOSITION after decomposing tasks
4. Request stdout data with /SHOWTERMINAL ON ITS OWN LINE
5. Use cat, tail, echo, sed, and unified diff to manipulate files.
6. Ask questions with /ASK <question> on its own line
7. Signal completion by outputting /DONE on its own line
8. ||NO COMMENTARY OR FORMATTING||`
    },{
        role: "user",
        content: `Primary Goal:
[ ] ${query}

`}];
    process.chdir(path);
    let iterations = 0, pendingOutput = [];
    log(`Starting software developer with ${messages.length} messages in ${path}`);
    let tasksList: any = [], messagesSize = 0;
    while(iterations < maxIterations) {

        let result = '';
        try {
            log(messages[messages.length - 1].content);
            result = await getCompletion(messages, {
                model: 'gpt-4',
                max_tokens: 2048,
                temperature: 0.01,
            })
            log(result)
        } catch (e) {
            if(JSON.stringify(e).indexOf(' currently overloaded with other requests') > -1) {
                continue;
            };
        }

        if(result.startsWith('/DONE')) {
            sseStream.send(null, 'close');
            return {
                messages,
                tasksList
            }
        }

        const validCommands = [
            'TASK',
            'DECOMPOSITION',
            'SHOWTERMINAL',
            'ASK',
            'DONE',
        ]
        let isDone = false
        if(result.startsWith('/ASK')) {
            const question = result.split(' ').slice(1).join(' ');
            return {
                messages,
                tasksList,
                question
            }
            continue;
        }

        // filter out anything that starts with /
        let bashStatement = result.split('\n').filter(e => !e.startsWith('/')).join('\n');
        let bashResults;
        if(bashStatement.trim()) {
            bashResults = shell.exec(bashStatement, { silent: true });
            log(bashResults.stdout);
            if(bashResults.stdout) {
                pendingOutput.push(bashResults.stdout);
            }
            messages.push({
                role: "user",
                content: bashStatement
            })
            log(bashStatement)
            messages.push({
                role: "system",
                content: bashResults
            })
            log(bashStatement)
            if(bashResults.stderr) {
                pendingOutput.push('ERROR' + bashResults.stderr);
            }
        }

        // if it starts with [ ] then it's a task
        if(bashStatement.startsWith('[')) {
            // this is a task
            if(bashStatement.includes('[ ]')) { 
                pendingOutput.push(bashStatement);
                log(bashStatement);
            }
        }
        // if it starts with / then its a command
        else if(bashStatement.startsWith('/')) {
            const command = bashStatement.split('/')[1];
            if(!validCommands.includes(command)) {
                pendingOutput.push(`Invalid command: ${command}`);
            }
            pendingOutput.push(`/${command}`);
            switch(command.split(' ')[0]) {
                case 'TASK':
                    let taskName = bashStatement.split(' ').slice(1).join(' ');
                    pendingOutput.push(`[x] ${taskName}`);

                    // find the task in the task list
                    const taskIndex = tasksList.indexOf(taskName);
                    if(taskIndex > -1) {
                        tasksList.splice(taskIndex, 1);
                    }
                    while(messages.length > messagesSize) {
                        messages.pop();
                    }

                    messages.push({
                        role: "assistant",
                        content: pendingOutput.join('\n') 
                        + '\n/TASK'
                    })
                    log(pendingOutput.join('\n') + '\n/TASK')
                    taskName = tasksList[0];
                    messages.push({
                        role: "user",
                        content: 'Complete the task: ' + taskName
                    })
                    log('Complete the task: ' + taskName)
                    break;

                case 'SHOWTERMINAL':
                    const se = shell.exec('ls', { silent: true });
                    messages.push({
                        role: "user",
                        content: bashResults + "\n" + se.stdout
                    })
                    bashResults =  '';
                    pendingOutput = [];
                    break;

                case 'DECOMPOSITION':
                    // get the first incomplete task
                    tasksList = pendingOutput.filter((line)=> line.startsWith('[ ]'));
                    messagesSize = messages.length;
                    const incompleteTask = tasksList[0];
                    messages.push({
                        role: "assistant",
                        content: pendingOutput.join('\n') 
                        + '\n/DECOMPOSITION\n'
                    })
                    log(pendingOutput.join('\n') + '\n/DECOMPOSITION\n')
                    messages.push({
                        role: "user",
                        content:'Complete the task: ' + incompleteTask
                    })
                    log('Complete the task: ' + incompleteTask)
                    break;

                default:
                    pendingOutput.push(`Invalid command: ${command}`);
                    break;
            }
        }

        // if there are pending output, add it to the messages
        if(pendingOutput.length > 0) {
            messages.push({
                role: "assistant",
                content: pendingOutput.join('\n')
            })
            log(pendingOutput.join('\n'))
            pendingOutput = [];
        }

        if(isDone) {
            log('Done');
            onUpdate({});
            if(sseStream) sseStream.send(null);
            return;
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