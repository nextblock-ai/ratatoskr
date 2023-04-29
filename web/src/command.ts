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
function commentInInvalidBashLines(lines: any) {
    lines = lines.split('\n');
    return lines.map((line: string | string[]) => {
        if(validShellCommands.some((command) => line.indexOf(command) > -1)) {
            return line;
        }
        return (line as any).replace('#', '');
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
        content: `📝You are an expert in autonomous iterative app development. You efficiently build visually appealing and functional apps, but you cannot create natural-language conversational responses. Follow these steps, ensuring to always output single-line bash statements:

        1️⃣ Automatically break down the complex task you're facing into smaller tasks, each on a separate line with a ✅ checkbox. Output the 🔍 magnifying glass emoji on its own line to represent the decomposition and stop. Remember, only output single-line bash statements. 
        
        2️⃣ Implement the first decomposed task on your list by issuing the appropriate commands.
        3️⃣ Use cat, tail, echo, sed, grep, and unified diff to manipulate files. 
        4️⃣ Signal completion of a task by marking the task complete in your tasks file, then outputting 📝 <taskname> on its own line and stop.
        5️⃣ Finish implementing the decomposed tasks sequentially in this manner before you move forward. 
        6️⃣ Implement the rest of the tasks using the above methodology. Utilize whatever tools necessary to complete the job, decomposing 🔎 and implementing📝 all tasks until you are done. Ensure that your outputs are single-line bash statements.
        7️⃣ Issue  💬 <question> on its own line to ask a question.
        8️⃣ Make sure to use single-line bash statements.
        9️⃣ When you complete the project, write 🏁 on its own line.
        🔟 Note: | Your output goes directly into bash input without any natural-language responses or commentary | SO NEVER OUTPUT NATURAL LANGUAGE, MULTILINE STATEMENTS OR COMMENTARY | 🚫 Always use single-line bash statements.`
    },{
        role: "user",
        content: query
    }];
    process.chdir(path);
    let iterations = 0;
    log(`Starting software developer with ${messages.length} messages in ${path}`);
    let messagesSize = 0;
    let curTaskName = '';
    let taskToMessagMap: any = {};
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
                '✅',
                '📝',
                '🔍',
                '💬',
                '🏁',
            ].map((command) => result.startsWith(`#${command}`));
        const unalteredContent = result;
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
            let taskIndex = 0;
            resultLines.slice(1).forEach((line: string) => {
                if(line.startsWith('✅')) {
                    const theTask = line.split(' ').slice(1).join(' ');
                    taskToMessagMap[theTask] = messages.length;
                    taskIndex++;
                    if(taskIndex === 1) { curTaskName = theTask;  }
                    return;
                }
            })
        }
        if(isTaskEnd) {
            
            // get the content previous to the task command
            bashContent = result.split('📝')[0]
            const taskName = result.split(' ').slice(1).join(' ');
            
            // parse the message that the command is in, remove the message
            let oldMessages = messages[taskToMessagMap[taskName]] ? messages[taskToMessagMap[taskName]].content.split('\n') : [];
            oldMessages = oldMessages.filter((line: string | string[]) => line.indexOf(taskName) === -1 || line.indexOf(curTaskName) === -1)
            const newTask = result.split('📝')[1];
            // get the new task if there is one 

            // get the index of the task
            const startIndex = taskToMessagMap[taskName];
            if(startIndex) {
                // remove all tasks after the start index
                messages[startIndex].content = oldMessages.join('\n');
                while(messages.length > startIndex) { messages.pop(); }
                delete taskToMessagMap[taskName];
            }
        }
        else if(isDecomposed) {
            // get the content previous to the decomposed command
            result = result.replace('🔎', '#🔎');
            bashContent = result;
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
            bashContent = commentOutInvalidBashLines(bashContent);
            bashResults = executeBashCommand(bashContent, log);
            bashContent = commentInInvalidBashLines(bashContent);
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
                content: `🔎`
            })
            log(`🔎`)
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