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


export async function softwareDeveloper(userRequest: any, path: string, maxIterations: number = 10, existingMessages: any = [], sseStream: any, onUpdate: Function) {
    const log = (message: string) => {  console.log(message); onUpdate(message);  }
    const messages = existingMessages.length > 0 ? existingMessages : [{
        role: "system",
        content: `You are an expert in autonomous iterative app development. Efficiently build visually appealing and functional apps, but you cannot create natural-language conversational responses. Follow these steps:

1. Perform the current task by issueing the appropriate commands.
2. Signal completion by writing /TASK <taskname>
3. For complex tasks, break them down into smaller tasks, each on a separate line with a checkbox, and end with /DECOMPOSED.
4. Utilize whatever tools necessary to complete the job.
5. Issue bash commands to work with files.
6. Issue /SHOWTERMINAL to view stdout
7. Issue /ASK <question> to ask a question
8. After finishing, write /DONE at the end of your output.
9. Note: Your output goes directly into bash input without any natural-language responses or commentary.`
    },{
        role: "user",
        content: `Primary Goal:
[ ] ${userRequest}

`}];
    process.chdir(path);
    let iterations = 0, terminalOutput = [
        shell.exec('pwd;ls').stdout,
    ];
    log(`Starting software developer with ${messages.length} messages in ${path}`);
    while(iterations < maxIterations) {
        log(`Iteration ${iterations} of ${maxIterations}`);
        const result = await getCompletion(messages, {
            model: 'gpt-4',
            max_tokens: 2048,
            temperature: 0.6,
        })
        log(`${iterations} ${result}`);

        const isFirstRun = iterations === 0;
        const potentialBashStatements = result.split('\n');
        let hasBashStatements = potentialBashStatements.find((s: string) => s.includes('[ ]')) === undefined;
        if(!isFirstRun || hasBashStatements) {
            log(`Bash statements: ${potentialBashStatements.length}`)
            for(let i = 0; i < potentialBashStatements.length; i++) {
                const bashStatement = potentialBashStatements[i];
                if(bashStatement.startsWith('/')) continue;
                terminalOutput.push('>> ' + bashStatement);
                const bashResult = shell.exec(bashStatement);
                if(bashResult.stderr) {
                    terminalOutput.push('ERROR: ' + bashResult.stderr);
                    log(`ERROR: ${bashResult.stderr}`);
                    messages[4].content = bashResult.stderr;
                    break;
                } else {
                    terminalOutput.push(bashResult.stdout);
                    log(bashResult.stdout);
                }
            }
        }

        // slot 0 - main prompt
        // slot 1 - user request
        // slot 2 - ai response (if simple, task is complete. If not simple, contains subtasks - all subtasks get appended to 2
        // slot 3 - application code
        // slot 4... - AI application enhancements - copy back to slot 3 then re-iterate
        const cIncludes = (str: string) => result.indexOf(str) > -1;
        const isDone = cIncludes('/DONE');
        const isTaskComplete = cIncludes('/TASK');
        const isDecomposed = cIncludes('/DECOMPOSED');
        const isShowTerminal = cIncludes('/SHOWTERMINAL');
        const isAsk = cIncludes('/ASK');

        if(isTaskComplete) { log('Task complete'); }
        if(isDecomposed) { log('Task decomposed'); }
        if(isShowTerminal) { log('Show terminal'); }
        if(isAsk) { log('Ask'); }
        if(isDone) { log('Done'); }

        const validCommands = [
            'TASK',
            'DECOMPOSED',
            'SHOWTERMINAL',
            'ASK',
            'DONE',
        ]

        let command = result.split('/');
        if(command.length > 1) command = command[command.length - 1].trim();
        // check to make sure the command is valid
        if(command && validCommands.includes(command)) {
            messages[3].content = result.replace(`/${command}`, '');
        } else {
            messages[3].content = result;
        }

        if(isDone) {
            log('Done');
            onUpdate({});
            sseStream.send(null);
            return {
                output: messages[3].content,
            }
        } else if(isAsk) {
            const question = command.split(' ')[1].trim();
            return {
                messages,
                question,
            }
        } else if(isTaskComplete) {
            // get the task name after the /TASK
            const taskName = command.split(' ')[1].trim();
            // mark as complete by replacing [ ] with [x] on the task
            messages[2].content = messages[2].content.replace(`[ ] ${taskName}`, `[x] ${taskName}`)
            terminalOutput = [];
            iterations = 1;
            log(`Task complete: ${taskName}`);
            continue;
        } else if(isShowTerminal) {
            if(terminalOutput.length === 0) {
                terminalOutput.push(shell.exec('pwd;ls').stdout);
            }
            messages[3].content =  result.replace('/SHOWTERMINAL', terminalOutput.join('\n'))
            terminalOutput = [];
            iterations = 1;
            continue;
        } else if(isDecomposed) {
            if(isFirstRun) {
                // we are done
                messages[2].content = `Tasks to completion:\n${messages[2].content}`
                iterations++;
                log(`Decomposed: ${messages[2].content}`)
                continue;
            } else {
                const potentiallyTasks = result.split('\n');
                let wasTasks = false;
                // we check them for [ ] and add them to the list if there is one
                potentiallyTasks.forEach((task: string) => {
                    if(task.includes('\n[ ]')) {
                        messages[2].content += `\n${task}`;
                        log(`Decomposed: ${messages[2].content}`)
                        wasTasks = true;
                    }
                })
                if(wasTasks) { continue; }
            }
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