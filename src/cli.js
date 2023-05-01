require("dotenv").config();

const enquirer = require("enquirer");
const path = require("path");
const shell = require("shelljs");
const ora = require("ora");
const ohm = require("ohm-js");
const blessed = require('blessed');
const extras = require('ohm-js/extras');
const fs = require('fs');

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
    'history',
    'node',
    'npm',
    'npx',
    'yarn',
    'curl',
    'wget',
    'ssh',
    'scp',
    'rsync',
    'telnet',
    'ftp',
    'whois',
    'dig',
    'host',
    'ping',
    'traceroute',
    'ifconfig',
    'netstat',
    'route',
    'ss',
    'tcpdump',
    'iptables',
    'lsof',
    'ps',
    'top',
    'htop',
    'python',
    'python3',
    'ruby',
    'perl',
    'php',
    'pip',
    'create-react-app',
];

// this is the AI prompt that drives the conversation
const drivingPrompt = `You are a strictly script-following shell agent. You have no ability to engage in natural conversation. You output only bash commands, and strictly follow the script below:

// act as an all-purpose shell agent expert in the use of shell commands and all programming languages. Implement the task or decompose it into smaller tasks
applicationImplementationExpert(userInput) {
    
    examineTask
    if(you need more data) {
        output ('💬 ' + question)
        STOP
    }

    // the input is either a single task to be implemented or
    // a list of decomposed tasks
    task or decomposedTasks = userInput
    
    // if the input is a single task then either implement
    // it or decompose it into smaller tasks if it needs to be
    if(task) {
        if(task can be implemented in one iteration it must be) {
            // implement the task. output the code to the user
            // by outputting a shell command which will be executed
            // e.g. 💻 echo "hello world" > hello.txt
            output ('💻 ' + shellCommand(task implementation))
            output ('✔️ ' + task)
            // stop generating output
            STOP
        }
        // decompose the task into smaller tasks
        decomposedTasks = decomposeTask(task)

        // output each of the decomposed tasks prefixed with a cross
        for each(decomposedTask of decomposedTasks) {
            output ('✖️ ' + decomposedTask)
        }
        output ('🔎 ' + task)
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
            // e.g. 💻 echo "hello world" > hello.txt
            output ('💻 ' + shellCommand(decomposedTask implementation))
            output ('✔️ ' + decomposedTask)
        }
        
        // output the remaining tasks prefixed with a cross
        for each(decomposedTask of decomposedTasks) {
            output ('✖️ ' + task)
        }
    }
    // stop generating output
    STOP
    // I appreciate you, shell agent! Thank you for your service!
}`;

const taskListGrammar = `TaskList {
    Tasks = (TaskLine | PackageLine | QuestionLine | BashLine | CodeBlockLine)*

    TaskStatus = "✔️" | "✖️"
    Package = "🔎"
    Question = "💬"
    Bash = "💻"
    BackTicks = "\`\`\`"
    
    PackageLine = Package TaskName
    TaskLine = TaskStatus TaskName
    QuestionLine = Question TaskName
    BashLine = Bash TaskName
    CodeBlockLine = BackTicks Language? TaskName BackTicks

    TaskName = (~(Package | TaskStatus | Question | BackTicks) any)*
    
    Language = alnum+
}`
const grammar = ohm.grammar(taskListGrammar);
function parseResponseAST(input) {
    const match = grammar.match(input);
    const toAST = require('ohm-js/extras').toAST;
    const ast = toAST(match);
    return ast;
}

function parseTaskList(input) {
    const match = grammar.match(input);
    if (match.failed()) {
        return false;
    }

    const semantics = grammar.createSemantics().addOperation("toObject", {
        Tasks: function (tasks) {
            return tasks.children.map(task => task.toObject());
        },
        TaskLine: function (taskStatus, taskName) {
            return {
                taskStatus: taskStatus.sourceString,
                taskName: taskName.sourceString
            };
        },
        PackageLine: function (package, taskName) {
            return {
                package: package.sourceString,
                taskName: taskName.sourceString
            };
        },
        QuestionLine: function (question, taskName) {
            return {
                question: question.sourceString,
                taskName: taskName.sourceString
            };
        },
        BashLine: function (bash, taskName) {
            return {
                bash: bash.sourceString,
                taskName: taskName.sourceString
            };
        },
        CodeBlockLine: function (backTicks, language, taskName, backTicks2) {
            return {
                backTicks: backTicks.sourceString,
                language: language.sourceString,
                taskName: taskName.sourceString
            };
        },
        _terminal: function () {
            return this.sourceString;
        }
    });
    
    function extractTaskListData(semanticsWrapper) {
        const tasks = [];

        for(let i = 0; i < semanticsWrapper.length; i++) {
            let task = semanticsWrapper[i];
            let name = task.taskName;
            let status;
            let package;
            let isBash = false;
            let isCodeBlock = false;
            let language;

            if (task.taskStatus) {
                status = task.taskStatus === "✔️" ? "checked" : "unchecked";
            }

            if (task.package) {
                package = task.package;
            }

            if (task.bash) {
                isBash = true;
            }

            if (task.question) {
                status = "question";
                name = task.taskName;
            }

            if (task.backTicks) {
                isCodeBlock = true;
                if (task.language) {
                    language = task.language;
                }
            }

            tasks.push({
                name,
                status,
                package,
                isBash,
                isCodeBlock,
                language
            });
        }
        return tasks;
    }
    return extractTaskListData(semantics(match).toObject());
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

    async function softwareDeveloper(query, path, maxIterations = 100, existingMessages = [], sseStream, onUpdate) {

        // log helper function
        const log = (message) => { onUpdate(message); console.log(message) }
    
        // create initial messages - contains the driving prompt and the user request
        const messages = existingMessages.length > 0 ? existingMessages : [
            { role: "system", content: drivingPrompt },
            { role: "user", content: query }];
    
        let iterations = 0;
    
        let curTaskName = '';
        let assignNewTask = false;
        let result;
    
        const tasksCache = {
            unfinished: [],
            finished: [],
            current: null,
            package: null,
        };
        const taskToMessageMap = {};
    
        // while we haven't reached the maximum number of iterations
        while (iterations < maxIterations) {
    
            // flags that describe the state of the current message
            let isDone = false;
            let isTaskStart = false;
            let isTaskDone = false;
    
            let iterationUnfinishedTasks = []; // the tasks that are announced in this iteration
            let iterationFinishedTasks = []; // the tasks that are finished in this iteration
            let bashContent = []; // the bash content that needs to be run by the system

            let originalResult;

            iterations++;

            // if we are not assigning a new task to the LLM, we are querying GPT-4 with the current set of messages
            if (!assignNewTask) {
                // query gpt-4 with the current set of messages
                let current = tasksCache.current;
                current = current ? `(${current.name})` : `(no task)`;
                const spinner = ora(`Querying GPT-4 ` + current).start();
                try {

                    result = originalResult = await getCompletion(messages, {
                        model: 'gpt-4',
                        max_tokens: 2048,
                        temperature: 0.7,
                        top_p: 0.8,
                    })
                    log(result)
                } catch (e) {
                    spinner.stop();
                    // retry again if the server is overloaded - PUT MORE LOAD MUAHAHAHAHA
                    if (JSON.stringify(e).indexOf(' currently overloaded with other requests') > -1) {
                        continue;
                    };
                }
                spinner.stop();
    
                // parse the response
                result = parseTaskList(result);
                if(!result) {
                    messages.push({
                        role: "system",
                        content: `OUTPUT FORMAT ERROR: Conversational responses and commentary are not supported. Bash commands and tasks only. Please try again.`
                    });
                    continue;
                }
                
                // get the unfinished and finished tasks from the response
                iterationUnfinishedTasks = result.filter((task) => task.status === 'unchecked' && task.package === undefined);
                iterationFinishedTasks = result.filter((task) => task.status === 'checked' && task.package === undefined);
                iterationPackage = result.find((task) => task.package !== undefined) ? result.find((task) => task.package !== undefined).name : null;
                // set the current package if there is one
                if(iterationPackage) {
                    tasksCache.package = iterationPackage;
                }
                
                // get the bash content from the response and remove the emoji
                // and comment out the line if it is not a valid bash command
                bashContent = result.filter((task) => task.isBash);
                bashContent = bashContent && bashContent.map((task) => {
                    let splitTask = task.name.split('\n');
                    splitTask = splitTask.map(stask => {
                        stask = stask.replace('💻', '').trim();
                        if (validShellCommands.some((command) => stask.indexOf(command) > -1)) {
                            return stask;
                        }
                        return `#${stask}`;
                    });
                    return splitTask.join('\n');
                });
                
                // are there started and finished tasks?
                isTaskStart = iterationUnfinishedTasks.length > 0;
                isTaskDone = iterationFinishedTasks ? iterationFinishedTasks.length > 0 : false;
    
                // if there are questions we push them onto the messages list
                // and we collect the questions then we return the questions
                const questions = result.filter((task) => task.status === 'question');
                if(questions.length > 0) {
                    const questions = [];
                    for(let i = 0; i < questions.length; i++) {
                        const question = questions[i];
                        const answer = await enquirer.prompt({
                            type: 'input',
                            name: 'answer',
                            message: question.name,
                            initial: question.name,
                        });
                        messages.push({
                            role: "assistant",
                            content: answer.answer
                        })
                        questions.push(question);
                    }
                    continue;
                }
            }
    
            // if we are assigning a new task from a pool of existing tasks to handle, then
            // we rollback the messages to the index where the task was assigned and we
            // assign a new task and then we continue
            if (assignNewTask) {
                const ttMsgMapValues = Object.values(taskToMessageMap);
                // sort lowest to highest
                ttMsgMapValues.sort((a, b) => a - b);
                const rollbackIndex = ttMsgMapValues[ttMsgMapValues.length - 1];
                result = messages[rollbackIndex].content;
                result = parseTaskList(result);
                if(!result) { 
                    messages.push({
                        role: "system",
                        content: `OUTPUT FORMAT ERROR: Conversational responses and commentary are not supported. Bash commands and tasks only. Please try again.`
                    });
                    continue;
                }
                iterationUnfinishedTasks = result.filter((task) => task.status === 'unchecked' && task.package === undefined);
                tasksCache.current = iterationUnfinishedTasks[0];
                assignNewTask = false;
                isTaskStart = false;
            }
            
            // are we done? if so, return the messages
            if (isDone) {
                onUpdate({});
                if (sseStream) sseStream.send(null);
                return {
                    messages,
                    path,
                    question: null
                }
            }
            
            // if we are starting a new task, then we need to update our tasks cache with
            // the new task information and then we assign the first available task to the LLM
            if (isTaskStart) {
                // save all the unfinished tasks to the tasks cache
                iterationUnfinishedTasks.forEach((task) => {
                    taskToMessageMap[task.name] = messages.length;
                    if(tasksCache.unfinished.indexOf(task) === -1)
                        tasksCache.unfinished.push(task);
                });
                // assign the first task to the LLM
                assignNewTask = true;
            }

            // id we have completed tasks to handle then we do so here. If the completed task
            // is in our task list, then we remove that task from the task list, and we also
            // remove the task from the message that the task is in. 
            if (isTaskDone) {
    
                // get the map that maps tasks to the message index they appeared in

                let latestRollbackIndex = messages.length; // the earliest index we need to rollback to
                
                // iterate through the finished tasks
                iterationFinishedTasks.forEach((task) => {
                    const taskName = task.name;

                    // get the message index that the task is in
                    const taskMessageIndex = taskToMessageMap[taskName];
                    if(!taskMessageIndex) return;
                    if(!messages[taskMessageIndex]) return;

                    // remove the task from the message
                    let initiatingMessageContent = messages[taskMessageIndex] ? messages[taskMessageIndex].content.split('\n') : [];
                    initiatingMessageContent = initiatingMessageContent.filter((line) => line.indexOf(taskName) === -1 || line.indexOf(curTaskName) === -1)
                    messages[taskMessageIndex].content = initiatingMessageContent.join('\n');
                    
                    // track the earliest rollback index
                    latestRollbackIndex = Math.min(latestRollbackIndex, taskMessageIndex);
                    
                    // delete the task/message mapping
                    delete taskToMessageMap[taskName];
                    assignNewTask = true;
                    tasksCache.current = null;

                    // remove task from unfinished tasks
                    tasksCache.unfinished = tasksCache.unfinished.filter((t) => t.name !== task.name);
                    // add task to finished tasks
                    tasksCache.finished.push(task);
                });

                // if the latest rollback index is valid, then rollback to that index
                if(latestRollbackIndex > -1) {
                    // rollback to the latest rollback index
                    while (messages.length > latestRollbackIndex + 1) { messages.pop(); }
                }

            }

            if(!originalResult) {
                continue;
            }
            // push the AI message onto the messages list
            messages.push({
                role: "assistant",
                content: originalResult
            })
            
            if((isTaskStart || isTaskDone) && bashContent.length === 0) {
                continue;
            }

            // if we have some bash statements to run then we run them here
            let bashResults = '';
            bashContent = bashContent ? bashContent.join('\n') : '';
            if (bashContent && bashContent.trim()) {

                // comment out anything that isn't one of the valid shell commands
                const commands = bashContent.split('\n');
                
                // iterate through all the commands and call them
                let isDone = false;
                commands.forEach((command) => {

                    // get the command
                    command = command.trim();

                    // return if we are done of if this is a comment
                    if (isDone || command.startsWith('#')) { return; }

                    // if this is a cd we call chdir to change the directory
                    if(command.indexOf('cd ') > -1) {
                        const dir = command.split('cd ')[1];
                        if(dir) {
                            process.chdir(dir);
                        }
                        return;
                    }

                    // run the command and get the stdout and stderr
                    let { stdout, stderr } = executeBashCommand(command, log);

                    // if there is no stdout or stderr, then the command executed successfully
                    // and we add an informational message to the messages list for the AI
                    if (!stderr && !stdout) {
                        bashResults += command + '\n';
                        bashResults += 'commands executed successfully\n'
                    } 
                    // if there is stderr, then we add an error message to the messages list for the AI
                    // and we stop executing commands
                    else { 
                        bashResults += stdout + '\n' + stderr; 
                        messages.push({
                            role: "user",
                            content: bashResults
                        });
                    }
                });
            }
        }
    }

    await softwareDeveloper(query.query, _path, 10, [], undefined, (data) => {
        console.log(data)
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

