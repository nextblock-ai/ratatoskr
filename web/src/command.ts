import { jsonrepair } from "jsonrepair";
import { getCompletion } from "./gpt";
import { createConversation, queryDecompose, queryDependencies, queryIsAdditionalInformationRequired } from "./prompt";
import { applyUnifiedDiff, loadFiles } from "./utils";
import shell from "shelljs";
import path from "path";
import fs from "fs";
import config from "@/config";

const validShellCommands = [
    'cat',
    'tail',
    'echo',
    'sed',
    'grep',
    'diff',
    'ls',
    'cd',
    'pwd',
    'mkdir',
    'rm',
    'rmdir',
    'touch',
    'mv',
    'cp',
    'chmod',
    'chown',
    'chgrp',
    'ln',
    'find',
    'wc',
    'sort',
    'uniq',
    'cut',
    'tr',
    'tar',
    'gzip',
    'gunzip',
    'bzip2',
    'bunzip2',
    'zcat',
    'head',
    'less',
    'more',
    'file',
    'diff',
    'patch',
    'ps',
    'kill',
    'killall',
    'bg',
    'fg',
    'jobs',
    'nice',
    'nohup',
    'df',
    'du',
    'mount',
    'umount',
    'pwd',
    'free',
    'uptime',
    'whereis',
    'which',
    'locate',
    'alias',
    'clear',
    'env',
    'export',
    'history'];

function commentOutInvalidBashLines(lines: any) {
    lines = lines.split('\n');
    return lines.map((line: string | string[]) => {
        if(validShellCommands.some((command) => line.indexOf(command) > -1)) {
            return line;
        }
        return `#${line}`;
    }).join('\n');
}
function executeBashCommand(command: string, log: any) {
    const formattedCommand = command.replace(/[\r\n]+/g, ' ; ');
    function escapeSedCommand(command: string) {
        return command
          .replace(/\\/g, '\\\\') // Escape backslashes
          .replace(/'/g, "\\'"); // Escape single quotes
    }
    command = command.split('\n').map((line: string) => {
        if(line.startsWith('sed')) {
            const sedCommand = line.split(' ').slice(1).join(' ');
            return `sed '${escapeSedCommand(sedCommand)}'`;
        }
        return line;
    }).join('\n');
    log(formattedCommand);
    const { stderr, stdout, code } = shell.exec(formattedCommand, { silent: true });
    log(stdout);
    if(stderr) log('ERROR: ' + stderr +' ' + formattedCommand );
    if (code !== 0) {
        console.error(command, stderr);
        return { stderr, stdout: null };
    }
    return { stderr: null, stdout };
}
export 
async function softwareDeveloper(query: any, path: string, maxIterations = 10, existingMessages = [], sseStream: { send: (arg0: null) => void; } | undefined, onUpdate: { (data: any): void; (data: any): void; (arg0: {}): void; }) {
    const log = (message: string | null) => {  onUpdate(message);  }
    const messages = existingMessages.length > 0 ? existingMessages : [{
        role: "system",
        content: `You are an expert in autonomous iterative story development. You write exciting and engaging novels and stories, but you cannot create natural-language conversational responses. Follow these steps:

1. Automatically break down the complex task you're facing into smaller tasks, each on a separate line with a checkbox, then output (don't echo) #DECOMPOSED on its own line and stop.
2. Implement the first decomposed task on your list by issuing the appropriate commands.
3. Use cat, tail, echo, sed, grep and unified diff to manipulate files.
4. Signal completion of a task by marking the task complete in your tasks file then outputting #TASK <taskname> on its own line and stop.
5. Finish implementing the decomposed tasks sequentially in this manner before you move forward.
6. Implement the rest of the tasks using the above methodology. Utilize whatever tools necessary to complete the job, decomposing and implementing all tasks until you are done.
7. [issue #ASK <question> to ask a question.]
8. When outputting files, output one file at a time.
9. When you complete the project, write #DONE at the end of your output.
10. Note: |Your output goes directly into bash input without any natural-language responses or commentary |SO NEVER OUTPUT NATURAL LANGUAGE OR COMMENTARY|`
    },{
        role: "user",
        content: query
    }];
    process.chdir(path);
    let iterations = 0;
    log(`Starting software developer with ${messages.length} messages in ${path}`);
    let messagesSize = 0;
    let curTaskName = '';
    while(iterations < maxIterations) {
        let result = '';
        try {
            log(messages[messages.length - 1].content);
            result = await getCompletion(messages, {
                model: 'gpt-4',
                max_tokens: 2048,
                temperature: 1,
            })
            log(result)
        } catch (e) {
            if(JSON.stringify(e).indexOf(' currently overloaded with other requests') > -1) {
                continue;
            };
        }
        // check to see if we have any commands to execute
        const [ 
            isTaskStart, 
            isTaskEnd, 
            isDecomposed,
            isAsk, 
            isDone ] = [
                'TASK',
                '/TASK',
                'DECOMPOSED',
                'ASK',
                'DONE',
            ].map((command) => result.startsWith(`#${command}`));
        let bashContent:any = '';
        if(isAsk) {
            const question = result.split(' ').slice(1).join(' ');
            // add messages to the list
            messages.push({
                role: "assistant",
                content: question
            })
            return {
                messages,
                path,
                question
            }
        }
        if(isDone) {
            return {
                messages,
                path,
                question: null
            }
        }
        if(isTaskStart) {
            let resultLines = result.split('\n');
            curTaskName = resultLines[0].split(' ').slice(1).join(' ');
            if(!curTaskName) {
                throw new Error('No task name provided');
            }
            bashContent = resultLines.slice(1).join('\n');
            messagesSize = messages.length - 1;
        }
        if(isTaskEnd) {
            // get the content previous to the task command
            bashContent = result.split('#/TASK')[0]
            const taskName = result.split(' ').slice(1).join(' ');
            let oldMessages = messages[messagesSize].content.split('\n');
            oldMessages = oldMessages.filter((line: string | string[]) => line.indexOf(taskName) === -1 || line.indexOf(curTaskName) === -1)
            messages[messagesSize].content = oldMessages.join('\n');
            while(messages.length > messagesSize) {
                messages.pop();
            }
            messagesSize = messages.length - 1;;
        }
        else if(isDecomposed) {
            // get the content previous to the decomposed command
            result = result.replace('#DECOMPOSED', '');
            // if this is not bash content, then we need to comment out the lines
            result = bashContent = commentOutInvalidBashLines(result);
            messagesSize = messages.length;
        } else {
            // get the content previous to the decomposed command
            bashContent = result;
        } 

        if(bashContent) {
            messages.push({
                role: "assistant",
                content: bashContent
            })
        }

        let bashResults
        if(bashContent && bashContent.trim()) {
            bashResults = executeBashCommand(bashContent, log);
            const { stdout, stderr } = bashResults;
            let errStr = stdout
            errStr = stderr ? 'ERROR' + stderr : errStr;
            messages.push({
                role: "user",
                content:  errStr
            })
            log(errStr)
        }
        if(curTaskName) {
            messages.push({
                role: "user",
                content:  `Current task: ${curTaskName}`
            })
        }
        if(isDecomposed) {
            messages.push({
                role: "assistant",
                content: `#DECOMPOSED`
            })
            log(`#DECOMPOSED`)
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