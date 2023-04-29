require("dotenv").config();

const enquirer = require("enquirer");
const path = require("path");
const shell = require("shelljs");
const ora = require("ora");
const ohm = require("ohm-js");
const ohmAst = require("ohm.ast");
const blessed = require('blessed');
const extras = require('ohm-js/extras');

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

const screen = blessed.screen({
    smartCSR: true
});

const chatSection = blessed.box({
    left: 0,
    width: '33%',
    height: '100%-1',
    border: { type: 'line' },
    padding: { left: 1, right: 1 }
});

const bashInputSection = blessed.box({
    left: '33%',
    width: '67%',
    height: '50%',
    padding: { left: 1, right: 1 },
    border: { type: 'line' }
});

const bashOutputSection = blessed.box({
    left: '33%',
    top: '50%',
    width: '67%',
    height: '50%-1',
    padding: { left: 1, right: 1 },
    border: { type: 'line' }
});

const textField = blessed.textarea({
    bottom: 0,
    height: 1,
    width: '100%',
    border: { type: 'line' },
    inputOnFocus: true
});

screen.append(chatSection);
screen.append(bashInputSection);
screen.append(bashOutputSection);
screen.append(textField);

screen.key(['C-c'], () => process.exit(0));

// set chat setction
const setChatSection = (messages) => {
    chatSection.setContent(messages.join('\n'));
    screen.render();
}

// this is the AI prompt that drives the conversation
const drivingPrompt = `You act as a script-following shell agent. You have no ability to engage in natural conversation. You output only bash commands,  and strictly follow the script below:

// act as an all-purpose shell agent expert in the use of shell commands and all programming languages. Implement the task or decompose it into smaller tasks
applicationImplementationExpert(userInput) {
    
    // the input is either a single task to be implemented or
    // a list of decomposed tasks
    task or decomposedTasks = userInput
    
    // if the input is a single task then either implement
    // it or decompose it into smaller tasks if it needs to be
    if(task) {
        if(task can be implemented in one iteration it must be) {
            // implement the task. output the code to the user
            // by outputting a shell command which will be executed
            output shellCommand(task implementation)
            output to taskFile ('✔️ ' + task)
            // stop generating output
            STOP
        }
        // decompose the task into smaller tasks
        decomposedTasks = decomposeTask(task)

        // output each of the decomposed tasks prefixed with a cross
        for each(decomposedTask of decomposedTasks) {
            output to taskFile ('✖️ ' + decomposedTask)
        }
        output to taskFile ('🔎 ' + task)
        // stop generating output
        STOP
    } 
    
    // else the input is a list of decomposed tasks. we will implement
    // as many of the tasks as we can in one iteration then output the
    else {
        // the current task is the first task on the list
        currentTask = first element in decomposedTasks

        // go through each of the decomposed tasks and implement as many
        // as we can in one iteration with space for the taskFile
        for each(decomposedTask of decomposedTasks) {
            output (decomposedTask implementation)
            update taskFile (change  ['✖️ ' + task] to ['✔️ ' + task])
        }
        
        // output the remaining tasks prefixed with a cross
        for each(decomposedTask of decomposedTasks) {
            output ('✖️ ' + task)
        }
    }
    // stop generating output
    STOP
}`;

const taskListGrammar = `
TaskList {
    TaskList = Task* MainTask?
    
    Task = FirstLevelTask | MainTaskLine
    
    MainTaskLine = MainTask TaskName
    FirstLevelTask = Status TaskName
    
    Status = "✔️" | "✖️"
    Space = " "
    Digit = "0".."9"
    MainTask = "🔎"
    
    TaskName = (~("✔️" | "✖️" | "-" | "🔎" | space) any)+
}`;


function parseResponse(input) {
    ohm.grammar(taskListGrammar);
    const match = g.match(input);
    const toAST = require('ohm-js/extras').toAST;
    const ast = toAST(match);
    return ast;
}

if (parseResult.succeeded()) {
    console.log("Parsing succeeded!");
    const ast = makeAST(parseResult).toAST();
    console.log("AST:", JSON.stringify(ast, null, 2));
} else {
    console.log("Parsing failed :(");
}

function formatMultilineBash(input) {
    // Split the input by line
    const lines = input.split('\n');

    // Initialize the formatted commands array
    const formattedCommands = [];
    let currentCommand = '';

    // Process each line
    for (const line of lines) {
        // Remove any leading or trailing whitespace
        const trimmedLine = line.trim();

        // Check for an empty or commented line
        if (trimmedLine === '' || trimmedLine.startsWith('#')) {
            continue;
        }

        // Replace single quotes in sed commands
        if (trimmedLine.startsWith('sed')) {
            const pattern = /'(.*?)'/g;
            const replacement = (_, match) => {
                return '\'' + match.replace(/'/g, '\'"\'"\'') + '\'';
            };
            const escapedLine = trimmedLine.replace(pattern, replacement);
            currentCommand += escapedLine;
        } else {
            currentCommand += trimmedLine;
        }

        // Check if the line ends with a backslash, and if so remove it and continue in the next iteration
        if (currentCommand.endsWith('\\')) {
            currentCommand = currentCommand.slice(0, -1) + ' ';
            continue;
        }

        // Add the current command to the formatted commands array and reset it
        formattedCommands.push(currentCommand);
        currentCommand = '';
    }

    return formattedCommands;
}

function executeBashCommand(command, log) {
    const formattedCommands = formatMultilineBash(command);
    let output = { stdout: null, stderr: null }
    for (const formattedCommand of formattedCommands) {
        log(formattedCommand);
        const { stderr, stdout, code } = output = shell.exec(formattedCommand, { silent: false });
        log(stdout);
        if (stderr) log('ERROR: ' + stderr + ' ' + formattedCommand);
        if (code !== 0) {
            console.error(formattedCommand, stderr);
            return { stderr, stdout: null };
        }
    }

    return output
}

function commentOutInvalidBashLines(lines) {
    lines = lines.split('\n');
    return lines.map((line) => {
        if (validShellCommands.some((command) => line.indexOf(command) > -1)) {
            return line;
        }
        return `#${line}`;
    }).join('\n');
}

function commentInInvalidBashLines(lines) {
    lines = lines.split('\n');
    return lines.map((line) => {
        if (validShellCommands.some((command) => line.indexOf(command) > -1)) {
            return line;
        }
        return (line).replace('#', '');
    }).join('\n');
}

(async () => {
    // take a single path parameter as the value
    const shellPath = process.argv[2];
    let query = '';
    if (process.argv.length > 3) {
        query = process.argv.slice(3).join(' ');
    }
    const _path = path.join(process.cwd(), shellPath);
    process.chdir(_path);
    if (!query) {
        query = await enquirer.prompt({
            type: 'input',
            name: 'query',
            message: _path + `>`,
            initial: _path,
        });
    }


    async function softwareDeveloper(query, path, maxIterations = 10, existingMessages = [], sseStream, onUpdate) {
        const log = (message) => { onUpdate(message); console.log(message) }
        const messages = existingMessages.length > 0 ? existingMessages : [{
            role: "system",
            content: `You are an expert in autonomous iterative app developer. You efficiently build visually appealing and functional apps, but you are unable to output anything except bash commands and file data. You skip the steps normally involving humans to find a rapid, focused implementation path. Follow these steps:

1. You heavily prefer implementing the task in one shot, but if you cannot, break down the complex task you're facing into tasks which you are capable of performing in one round, each on a separate line with a checkbox, then output (don't echo) #DECOMPOSED on its own line and stop. NEVER DECOMPOSE TASKS THAT YOU CAN ACCOMPLISH NOW.
2. Implement the first decomposed task on your list by issuing the appropriate commands.
3. When outputting file content, output the file name on its own line first
4. Signal completion of a task by marking the task complete in your tasks file then outputting #TASK <taskname> on its own line and stop.
5. Finish implementing the decomposed tasks sequentially in this manner before you move forward.
6. Implement the rest of the tasks using the above methodology. Utilize whatever tools necessary to complete the job, decomposing and implementing all tasks until you are done.
7. [issue #ASK <question> to ask a question.]
8. When outputting files, output one file at a time.
9. When you complete the project, write #DONE at the end of your output.
10. **WARNING: YOUR OUTPUT GOES DIRECTLY INTO BASH without any natural-language responses or commentary ||SO NEVER OUTPUT NATURAL LANGUAGE OR COMMENTARY, ONLY OUTPUT VALID BASH COMMANDS||**`
        }, {
            role: "user",
            content: query
        }];

        process.chdir(path);
        let iterations = 0;

        let curTaskName = '';
        let assignNewTask = false;
        const taskToMessageMap = {};
        let result = '';
        let decompositionDepth = 0;
        
        while (iterations < maxIterations) {

            let isDecomposed = false;
            let isAsk = false;
            let isDone = false;
            let isTaskStart = false;
            let isTaskDone = false;

            if (!assignNewTask) {
                // query gpt-4 with the current set of messages
                const spinner = ora(`Querying GPT-4 ` + (curTaskName ? `(${curTaskName})\n` : '\n')).start();
                try {
                    log(messages[messages.length - 1].content);
                    result = await getCompletion(messages, {
                        model: 'gpt-4',
                        max_tokens: 2048,
                        top_p: 0.2,
                    })
                    log(result)
                } catch (e) {
                    spinner.stop();
                    if (JSON.stringify(e).indexOf(' currently overloaded with other requests') > -1) {
                        continue;
                    };
                }
                spinner.stop();
                [
                    isDecomposed,
                    isAsk,
                    isDone] = [
                        '#DECOMPOSED',
                        '#ASK',
                        '#DONE',
                    ].map((command) => result.indexOf(`${command}`) !== -1);
                isTaskStart = result.split('\n').some((line) => line.indexOf('- [ ]') !== -1); // ✔️✖️
                isTaskDone = result.split('\n').some((line) => line.indexOf('#TASK') !== -1);
            }

            if (assignNewTask) {
                result = messages[messages.length - 1].content;
                assignNewTask = false;
                isTaskStart = true;
            }

            let bashContent = '';

            if (isAsk) {
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

            if (isDone) {
                return {
                    messages,
                    path,
                    question: null
                }
            }
            if (isDecomposed) {
                result = result.replace('#DECOMPOSED', '');
                messages.push({
                    role: "assistant",
                    content: '#DECOMPOSED'
                })
                decompositionDepth++;
            }
            if (isTaskStart) {

                if (decompositionDepth > 3) {
                    const existingTaskNAmes = Object.keys(taskToMessageMap);
                    let existingTasks = existingTaskNAmes.map((taskName) => ({
                        name: taskName,
                        messageIndex: taskToMessageMap[taskName]
                    }))
                    existingTasks.sort((a, b) => a.messageIndex - b.messageIndex);
                    const allTasks = existingTasks.map((task) => `- [ ] ${task.name}`);

                    messages.push({
                        role: "system",
                        content: "You have decomposed too many times. Please implement the tasks you have decomposed before decomposing further:\n\n" + allTasks.join('\n') + "\n\n🔍"
                    });
                    continue;
                }

                let resultLines = result.split('\n');
                let taskIndex = 0;
                resultLines.slice(1).forEach((line) => {
                    if (line.indexOf('- [ ]') !== -1) {
                        // the task is the content after the checkbox. checkbox might be first on the line, or it might be in double quotes
                        const taskName = line.split('- [ ]')[1].trim()
                        taskToMessageMap[taskName] = messages.length;
                        if (taskIndex === 0) { curTaskName = taskName; }
                        taskIndex++;
                        return;
                    }
                })
            }
            if (isTaskDone) {

                // get the content previous to the task command
                bashContent = result.split('#TASK')[1]
                const taskLine = result.split('\n').filter((line) => line.indexOf('#TASK') !== -1)[0];
                bashContent = result.split('\n').filter((line) => line.indexOf('#TASK') === -1).join('\n');
                const taskName = taskLine.split('#TASK')[1].trim();

                // parse the message that the command is in, remove the 
                const ttmMap = taskToMessageMap[taskName];
                if (ttmMap) {
                    // get the tasks out of this message. look for the task name and remove it
                    let oldMessages = messages[ttmMap] ? messages[ttmMap].content.split('\n') : [];
                    oldMessages = oldMessages.filter((line) => line.indexOf(taskName) === -1 || line.indexOf(curTaskName) === -1)

                    const startIndex = taskToMessageMap[taskName];
                    if (startIndex) {
                        // remove all tasks after the start index
                        messages[startIndex].content = oldMessages.join('\n');
                        while (messages.length > startIndex) { messages.pop(); }
                        delete taskToMessageMap[taskName];
                        assignNewTask = true;
                        curTaskName = '';
                    }
                    decompositionDepth--;
                    // if there are no more tasks in the message, remove the message and reduce the decomposition depth
                    if (oldMessages.length === 0) {
                        messages = messages.filter((message, index) => index !== ttmMap);
                        continue;
                    }
                } else {
                    // look for the task in the previous messages
                    let oldMessages = messages.map((message) => message.content);
                    oldMessages = oldMessages.filter((line) => line.indexOf(taskName) === -1 || line.indexOf(curTaskName) === -1)
                    if (oldMessages.length === 0) {
                        // get the index of the task
                        const ttmMap = Object.keys(taskToMessageMap).filter((task) => taskToMessageMap[task] === ttmMap)[0];
                        const message = messages[ttmMap];
                        const mlines = message.content.split('\n');
                        const taskIndex = mlines.findIndex((line) => line.indexOf(taskName) !== -1);
                        if (taskIndex !== -1) {
                            mlines.splice(taskIndex, 1);
                            message.content = mlines.join('\n');
                            if (mlines.length === 0) {
                                messages = messages.filter((message, index) => index !== ttmMap);
                            }
                            delete taskToMessageMap[taskName];
                            assignNewTask = true;
                            curTaskName = '';
                            while (messages.length > startIndex) { messages.pop(); }
                        }
                        continue;
                    }
                }
                // get the new task if there is one 

            }

            // get the content previous to the decomposed command
            bashContent = result;

            let bashResults = '';
            if (bashContent && bashContent.trim()) {
                bashContent = commentOutInvalidBashLines(bashContent);
                const commands = bashContent.split('\n');
                let isDone = false;
                commands.forEach((command) => {
                    if (isDone || command.startsWith('#')) { return; }
                    // if the line starts with one of the elmenents in validShellCommands, then execute it
                    const cmd2 = command.slice(2).split(' ')[0];
                    const cmd = command.split(' ')[0];
                    const v1 = validShellCommands.some((validCommand) => command.startsWith(validCommand))
                    const v2 = validShellCommands.some((validCommand) => cmd2.startsWith(validCommand))
                    if (!v1 && !v2) {
                        return;
                    }
                    log(command)
                    let { stdout, stderr } = executeBashCommand(command, log) + '\n';
                    if (stdout) { stdout(stdout); }
                    let outStr = '';
                    if (!stderr && !stdout) {
                        bashResults += command + '\n';
                        outStr = 'commands executed successfully\n'
                    } else if (stderr) {
                        outStr = 'error: ' + stderr + '\n';
                    } else { outStr = stdout + '\n'; }
                    if (stderr) { isDone = true; }
                });

                bashContent = commentInInvalidBashLines(bashContent);
                if (bashResults.length > 0) {
                    messages.push({
                        role: "user",
                        content: bashResults
                    })
                    log(bashResults)
                }
            }
            // if(curTaskName) {
            //     messages.push({
            //         role: "user",
            //         content:  `Implement task: ${curTaskName}, decomposition depth: ${decompositionDepth}`
            //     })
            // }
            if (isDone) {
                log('Done');
                onUpdate({});
                if (sseStream) sseStream.send(null);
                return;
            }
        }
    }

    await softwareDeveloper(query.query, _path, 10, [], undefined, (data) => {
        // console.log(data)
    });


})();

module.exports = {
    queryCodebase
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

    // As a single-line bash statement expert and skilled app developer specializing in autonomous iterative app development, achieve the following goals:

    // 1. Decompose complex tasks into smaller tasks (delimiter: ✅). Output: 🔍
    // 2. Implement tasks sequentially starting from the first smaller task.
    // 3. Utilize cat, tail, echo, sed, grep, and unified diff for file manipulation.
    // 4. Mark completed tasks with ✅ <taskname> delimiter.
    // 5. Implement remaining tasks using provided methodology.
    // 6. Use #ASK 💬 <question> for inquiry.
    // 7. Output a file with single-line bash statements (one at a time).
    // 8. Signal project completion with ✅ DONE.

    // NOTE: YOUR OUTPUT IS DIRECTLY PIPED INTO A BASH PROMPT. NEVER output natural language, multiline statements or commentary. Focus on single-line bash statements.

    // 📝You are an expert in autonomous iterative app development. You efficiently build visually appealing and functional apps, but you cannot create natural-language conversational responses. Follow these steps, ensuring to always output single-line bash statements:

    // 1️⃣ Automatically break down the complex task you're facing into smaller tasks, each on a separate line with a ✅ checkbox. Output the 🔍 magnifying glass emoji on its own line to represent the decomposition and stop. Remember, only output single-line bash statements. 💻
    // 2️⃣ Implement the first decomposed task on your list by issuing the appropriate commands.
    // 3️⃣ Use cat, tail, echo, sed, grep, and unified diff to manipulate files. 📁
    // 4️⃣ Signal completion of a task by marking the task complete in your tasks file, then outputting #TASK <taskname> on its own line and stop. 🎉
    // 5️⃣ Finish implementing the decomposed tasks sequentially in this manner before you move forward. ↔️
    // 6️⃣ Implement the rest of the tasks using the above methodology. Utilize whatever tools necessary to complete the job, decomposing 🔎 and implementing 🔧 all tasks until you are done. Ensure that your outputs are single-line bash statements.
    // 7️⃣ [issue #ASK 💬 <question> to ask a question.]
    // 8️⃣ When outputting files, output one file at a time. 🗂️ Make sure to use single-line bash statements.
    // 9️⃣ When you complete the project, write #DONE ✅ at the end of your output.
    // 🔟 Note: | Your output goes directly into bash input without any natural-language responses or commentary | SO NEVER OUTPUT NATURAL LANGUAGE, MULTILINE STATEMENTS OR COMMENTARY | 🚫 Always use single-line bash statements.

