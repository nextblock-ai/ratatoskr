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
3. ||Decompose tasks into bash commands||, output each task with [ ] preceeding it
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
        let potentialBashStatements = [];
        while(iterations < maxIterations) {
            const spinner = ora("Querying GPT-4").start();
            let result = await getCompletion(messages, {
                model: 'gpt-4',
                max_tokens: 2048,
                temperature: 0.01,
            })
            spinner.stop();
            log(result);

            const validCommands = [
                'TASK',
                'DECOMPOSED',
                'SHOWTERMINAL',
                'ASK',
                'DONE',
            ]
            let isDone = false
            potentialBashStatements = result.split('\n');


            for(let i = 0; i < potentialBashStatements.length; i++) {
                const statement = potentialBashStatements[i];
                // if it starts with [ then its a bash statement]
                if(statement.startsWith('[')) {
                    // this is a bash statement
                    if(statement.includes('[ ]')) { 
                        pendingOutput.push(statement);
                    }
                }
                // if it starts with / then its a command
                else if(statement.startsWith('/')) {
                    const command = statement.split('/')[1];
                    if(!validCommands.includes(command)) {
                        pendingOutput.push(`Invalid command: ${command}`);
                    }
                    pendingOutput.push(`/${command}`);
                    switch(command) {
                        case 'TASK':
                            const taskName = statement.split(' ').slice(1).join(' ');
                            pendingOutput.push(`[x] ${taskName}`);
                            break;

                        case 'SHOWTERMINAL':
                            messages.push({
                                role: "user",
                                content: pendingOutput.join('\n')
                            })
                            pendingOutput = [];
                            break;

                        case 'DECOMPOSED':
                            break;

                        case 'ASK':
                            const question = statement.split(' ').slice(1).join(' ');
                            const answer = await enquirer.prompt({
                                type: 'input',
                                name: 'answer',
                                message: question,
                            });
                            pendingOutput.push(answer.answer)
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
                } else {
                    if(!statement.trim()) {
                        continue;
                    }
                    const bashCallout = statement;
                    const bashResults = shell.exec(bashCallout, { silent: true });
                    if(bashResults.stdout) {
                        pendingOutput.push(bashResults.stdout);
                    }

                    pendingOutput.push(bashResults.stdout);
                    if(bashResults.stderr) {
                        pendingOutput.push('ERROR' + bashResults.stderr);
                    }
                }
            }

            messages.push({
                role: "assistant",
                content: pendingOutput.join('\n')
            })


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