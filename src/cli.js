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
const { message } = require("blessed");

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


    async function softwareDeveloper(query, path, maxIterations = 10, existingMessages = [], sseStream, onUpdate) {
        const log = (message) => {  onUpdate(message);  }
        const messages = existingMessages.length > 0 ? existingMessages : [{
            role: "system",
            content: `You are a master developer skilled in bash commands, task decomposition, app design and implementation. Given user input, you either implement the task in one-shot or you decompose the task then implement the sub-tasks.
1. No natural-language responses or commentary. ALL COMMANDS ON THEIR OWN LINE
2. Complete task, then output /TASK <taskname>.
3. ||Decompose tasks into bash commands||, output each task with [ ] preceeding it. Do not prefix bash commands with anything. 
4. Append /DECOMPOSITION after decomposing tasks
4. Request stdout data with /SHOWTERMINAL ON ITS OWN LINE
5. Use cat, tail, echo, sed, and unified diff to manipulate files.
6. Ask questions with /ASK <question> on its own line
7. Finish work with /DONE on its own line
8. ||NO COMMENTARY OR FORMATTING||`
        },{
            role: "user",
            content: `Primary Goal:
    [ ] ${query}
    
    `}];
        process.chdir(path);
        let iterations = 0, pendingOutput = [
        ];
        log(`Starting software developer with ${messages.length} messages in ${path}`);
        let potentialBashStatements = [], tasksList = [], messagesSize = 0;
        while(iterations < maxIterations) {
            const spinner = ora("Querying GPT-4").start();
            let result='';;
            try {
                result = await getCompletion(messages, {
                    model: 'gpt-4',
                    max_tokens: 2048,
                    temperature: 0.01,
                })
            } catch (e) {
                if(JSON.stringify(e).indexOf(' currently overloaded with other requests') > -1) {
                    continue;
                };
            }
            spinner.stop();
            if(result === '/DONE') {
                log('Done');
                break;
            }
            if(result.startsWith('/ASK')) {
                const question = bashStatement.split(' ').slice(1).join(' ');
                const answer = await enquirer.prompt({
                    type: 'input',
                    name: 'answer',
                    message: question,
                });
                messages.push({
                    role: "assistant",
                    content: question
                })
                messages.push({
                    role: "user",
                    content: answer.answer
                })
                continue;
            }
            log(result);

            const validCommands = [
                'TASK',
                'DECOMPOSITION',
                'SHOWTERMINAL',
                'ASK',
                'DONE',
            ]
            let isDone = false
            potentialBashStatements = result.split('\n');

            // filter out anything that starts with /
            let bashStatement = potentialBashStatements.filter(e => !e.startsWith('/')).join('\n');
            if(!bashStatement.trim()) {
                continue;
            }
            
            const bashResults = shell.exec(bashStatement, { silent: true });
            console.log(bashResults.stdout);
            if(bashResults.stdout) {
                pendingOutput.push(bashResults.stdout);
            }

            messages.push({
                role: "user",
                content: bashStatement
                + '\n/TASK'
            })
            messages.push({
                role: "system",
                content: bashResults
                + '\n/TASK'
            })

            if(bashResults.stderr) {
                pendingOutput.push('ERROR' + bashResults.stderr);
            }

            // if it starts with [ then its a bash statement]
            if(bashStatement.startsWith('[')) {
                // this is a bash statement
                if(bashStatement.includes('[ ]')) { 
                    pendingOutput.push(bashStatement);
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
                        taskName = tasksList[0];
                        messages.push({
                            role: "user",
                            content: 'Complete the task: ' + taskName
                        })

                        break;

                    case 'SHOWTERMINAL':
                        messages.push({
                            role: "user",
                            content: bashResults
                        })
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
            
                        messages.push({
                            role: "user",
                            content:'Complete the task: ' + incompleteTask
                        })
                        break;

                    case 'DONE':
                        messages.push({
                            role: "system",
                            content: pendingOutput.join('\n')
                        })
                        isDone = true;
                        return messages;

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

    await softwareDeveloper(query.query, _path, 10, [], undefined, (data)=> {
        console.log(data);
    });


})();

module.exports = {
    queryCodebase
}