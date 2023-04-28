require("dotenv").config();

const enquirer = require("enquirer");
const fs = require("fs-extra");
const path = require("path");
const shell = require("shelljs");
const ora = require("ora");
const {
    getCompletion,
} = require('./util');
const {
    queryCodebase,
} = require('./prompt');
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

(async () => {
    // take a single path parameter as the value
    const shellPath = process.argv[2];
    let query = '';
    if (process.argv.length > 3) {
        query = process.argv.slice(3).join(' ');
    }
    const _path = path.join(process.cwd(), shellPath);
    process.chdir(_path);
    if(!query) {
        query = await enquirer.prompt({
            type: 'input',
            name: 'query',
            message: _path + `>`,
            initial: _path,
        });
    }

// You are an expert in autonomous iterative app development. You efficiently build visually appealing and functional apps, but you cannot create natural-language conversational responses. Follow these steps:

// 1. Automatically break down the complex task you're facing into smaller tasks, each on a separate line with a checkbox, and end with /DECOMPOSED.
// 2. Implement the first decomposed task on your list by issuing the appropriate commands.
// 3. Use cat, tail, echo, sed, grep and unified diff to manipulate files.
// 4. Signal completion of a task by writing /TASK <taskname>. 
// 5. Finish implementing decomposed tasks in this manner before you move forward.
// 6. Implement the rest of the tasks. Utilize whatever tools necessary to complete the job, decomposing and implementing all tasks until you are done.
// 7. [Issue /SHOWTERMINAL to view stdout], [issue /ASK <question> to ask a question.]
// 8. When outputting files, output one file at a time.
// 9. When you complete the project, write /DONE at the end of your output.
// 10. Note: |Your output goes directly into bash input without any natural-language responses or commentary |SO NEVER OUTPUT NATURAL LANGUAGE OR COMMENTARY|

// You are a master software developer skilled in bash commands, task decomposition, and app design and implementation. Given user input, you either implement the task in one-shot or you decompose the task then implement the sub-tasks.
// 1. No natural-language responses or commentary. ALL COMMANDS ON THEIR OWN LINE
// 2. Complete task, then output /TASK <taskname>.
// 3. ||Decompose tasks into bash commands||, output each task with [ ] preceeding it. Do not prefix bash commands with anything. 
// 4. Append /DECOMPOSITION after decomposing tasks
// 4. Request stdout data with /SHOWTERMINAL ON ITS OWN LINE
// 5. Use cat, tail, echo, sed, and unified diff to manipulate files.
// 6. Ask questions with /ASK <question> on its own line
// 7. Signal completion by outputting /DONE on its own line
// 8. ||NO COMMENTARY OR FORMATTING||

    async function softwareDeveloper(query, path, maxIterations = 10, existingMessages = [], sseStream, onUpdate) {
        const log = (message) => {  onUpdate(message);  }
        const messages = existingMessages.length > 0 ? existingMessages : [{
            role: "system",
            content: `You are an expert in autonomous iterative app development. You efficiently build visually appealing and functional apps, but you cannot create natural-language conversational responses. Follow these steps:

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

            // query gpt-4 with the current set of messages
            const spinner = ora("Querying GPT-4\n").start();
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
                spinner.stop();
                if(JSON.stringify(e).indexOf(' currently overloaded with other requests') > -1) {
                    continue;
                };
            }
            spinner.stop();

 

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
            let bashContent = [];
            if(isAsk) {
                const question = result.split(' ').slice(1).join(' ');
                const answer = await enquirer.prompt({
                    type: 'input',
                    name: 'answer',
                    message: question,
                });
                // add messages to the list
                messages.push({
                    role: "assistant",
                    content: question
                })
                log(question)
                messages.push({
                    role: "user",
                    content: answer.answer
                })
                log(answer.answer)
                continue;
            }
            if(isDone) {
                const query = await enquirer.prompt({
                    type: 'input',
                    name: 'query',
                    message: 'What is the query?',
                });
                await softwareDeveloper(query.query, _path, 10, [], undefined, (data)=> {
                    console.log(data)
                });
                return;
            }
            if(isTaskStart) {
                resultLines = result.split('\n');
                curTaskName = resultLines[0].split(' ').slice(1).join(' ');
                if(!curTaskName) {
                    throw new Error('No task name provided');
                }
                result = resultLines.slice(1).join('\n');
                messagesSize = messages.length - 1;
            }
            function commentOutInvalidBashLines(lines) {
                lines = lines.split('\n');
                return lines.map((line) => {
                    if(validShellCommands.some((command) => line.indexOf(command) > -1)) {
                        return line;
                    }
                    return `#${line}`;
                }).join('\n');
            }
            if(isTaskEnd) {
                // get the content previous to the task command
                bashContent = result.split('#/TASK')[0]
                const taskName = result.split(' ').slice(1).join(' ');
                let oldMessages = messages[messagesSize].content.split('\n');
                oldMessages = oldMessages.filter((line) => line.indexOf(taskName) === -1 || line.indexOf(curTaskName) === -1)
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
                log(bashContent)
            }

            function executeBashCommand(command) {
                const formattedCommand = command.replace(/[\r\n]+/g, ' ; ');
                function escapeSedCommand(command) {
                    return command
                      .replace(/\\/g, '\\\\') // Escape backslashes
                      .replace(/'/g, "\\'"); // Escape single quotes
                }
                command = command.split('\n').map((line) => {
                    if(line.startsWith('sed')) {
                        const sedCommand = line.split(' ').slice(1).join(' ');
                        return `sed '${escapeSedCommand(sedCommand)}'`;
                    }
                    return line;
                }).join('\n');
                const { stderr, stdout, code } = shell.exec(formattedCommand, { silent: true });
                if (code !== 0) {
                    console.error(command, stderr);
                    return { stderr, stdout: null };
                }
                return { stderr: null, stdout };
            }

            let bashResults
            if(bashContent && bashContent.trim()) {
                bashResults = executeBashCommand(bashContent);
                const { stdout, stderr } = bashResults;
                let errStr = stdout
                errStr = stderr ? 'ERROR' + stderr : errStr;
                messages.push({
                    role: "user",
                    content:  errStr
                })
                log(errStr)
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

    await softwareDeveloper(query.query, _path, 10, [], undefined, (data)=> {
        console.log(data)
    });


})();

module.exports = {
    queryCodebase
}