/* ratatoskr:exclude
```mermaid
sequenceDiagram
    participant User
    participant ProblemSolverApp
    participant RequestParser
    participant RequestDecomposer
    participant CommandGenerator
    participant CommandExecutor
    participant TaskMonitorAndEvaluator
    participant LearningAndOptimization
    participant ErrorHandlerAndRecovery
    participant DataManager
    participant UserInteraction
    participant ExtensionManager

    User->>ProblemSolverApp: Solve(userRequest)
    ProblemSolverApp->>RequestParser: parse(userRequest)
    RequestParser-->>ProblemSolverApp: ParsedRequest
    ProblemSolverApp->>RequestDecomposer: decompose(ParsedRequest)
    RequestDecomposer-->>ProblemSolverApp: DecomposedRequest
    ProblemSolverApp->>CommandGenerator: generateCommands(DecomposedRequest)
    CommandGenerator->>ExtensionManager: getCommands()
    ExtensionManager-->>CommandGenerator: ICommand[]
    CommandGenerator-->>ProblemSolverApp: ICommand[]
    ProblemSolverApp->>CommandExecutor: executeCommands(ICommand[])
    CommandExecutor->>ExtensionManager: getExtensionByName(command)
    ExtensionManager-->>CommandExecutor: IExtension
    CommandExecutor->>IExtension: executeCommand(command, args)
    IExtension-->>CommandExecutor: ExecutionResult
    CommandExecutor-->>ProblemSolverApp: ExecutionResult[]
    ProblemSolverApp->>TaskMonitorAndEvaluator: monitor()
    ProblemSolverApp->>TaskMonitorAndEvaluator: evaluate()
    TaskMonitorAndEvaluator-->>ProblemSolverApp: EvaluationResult
    ProblemSolverApp->>LearningAndOptimization: optimize()
    ProblemSolverApp->>LearningAndOptimization: learn()
    ProblemSolverApp->>ErrorHandlerAndRecovery: handleError()
    ProblemSolverApp->>ErrorHandlerAndRecovery: recover()
    ProblemSolverApp->>DataManager: storeData()
    ProblemSolverApp->>DataManager: retrieveData()
    ProblemSolverApp->>UserInteraction: updateProgress()
    ProblemSolverApp->>UserInteraction: requestClarification()
    ProblemSolverApp->>UserInteraction: presentResults()
    UserInteraction-->>User: Results
```
*/

import "dotenv/config";
import * as shell from "shelljs";
import { OpenAIApi, Configuration } from 'openai';
import fs from 'fs';
import * as path from 'path';
const { hash } =require( 'hash-anything');
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { prompt } from 'enquirer';

const configuration = new Configuration({ apiKey: process.env.OPENAI_KEY });
const openai = new OpenAIApi(configuration);


enum RequestType {
    DirectCommand,
    ShowButNotRun,
    RegularRequest,
}

class ParsedRequest {
    constructor(
        public rawRequest: string,
        public requestType: RequestType
    ) { }
}

class DecomposedRequest {
    constructor(
        public parsedRequest: ParsedRequest,
        public subtasks: string[] = []
    ) { }
}

// Base Extension Interface
interface IExtension {
    name: string;
    registerCommands(): ICommand[];
    executeCommand(command: ICommand, args: any): Promise<any>;
}

// Base Command Interface
interface ICommand {
    name: string;
    description: string;
    execute(args: any): Promise<any>;
}

// Language Model Interface
interface ILanguageModel {
    name: string;
    call(request: string): Promise<any>;
}

class GPT4LanguageModel implements ILanguageModel {
    apiKey: string;

    constructor() {
        this.apiKey = process.env.OPENAI_KEY as string;
    }

    get name(): string {
        return 'GPT4';
    }

    async call(message: string): Promise<string> {
        const conversation = {
            model: 'gpt-4',
            messages: [{ role: 'user', content: message }],
            max_tokens: 2048,
            temperature: 1,
            top_p: 1,
        };

        let isJson = false,
            responseMessage = '';

        const _query = async (conversation: any, iter: any): Promise<any> => {
            let completion = await openai.createChatCompletion(conversation);
            responseMessage += (completion.data.choices[0].message as any).content.trim();

            if (iter === 0 && (responseMessage.startsWith('{') || responseMessage.startsWith('['))) {
                isJson = true;
            }

            if (isJson) {
                if (responseMessage.endsWith('}') || responseMessage.endsWith(']')) {
                    return responseMessage;
                } else {
                    conversation.messages.push({ role: 'assistant', content: responseMessage });
                    responseMessage += completion;
                    return _query(conversation, iter + 1);
                }
            } else {
                return responseMessage;
            }
        };

        const completion = await _query(conversation, 0);
        return completion;
    }
}

// Language Model Manager
class LanguageModelManager {
    private languageModels: ILanguageModel[] = [];

    registerLanguageModel(languageModel: ILanguageModel): void {
        this.languageModels.push(languageModel);
    }

    unregisterLanguageModel(languageModelName: string): void {
        this.languageModels = this.languageModels.filter(
            (lm) => lm.name !== languageModelName
        );
    }

    async call(languageModelName: string, request: string): Promise<any> {
        const languageModel = this.languageModels.find(
            (lm) => lm.name === languageModelName
        );

        if (!languageModel) {
            throw new Error(`Language model "${languageModelName}" not found.`);
        }

        return await languageModel.call(request);
    }
}

class RequestParser {
    parse(userRequest: string): ParsedRequest[] {
        const parsedRequests: ParsedRequest[] = [];

        // Split the user request into lines
        const lines = userRequest.split('\n').map((line) => line.trim());

        // Iterate through each line and create a ParsedRequest object
        for (const line of lines) {
            if (line.length > 0) {
                let requestType = RequestType.RegularRequest;

                if (line.startsWith('!')) {
                    requestType = RequestType.DirectCommand;
                } else if (line.startsWith('?')) {
                    requestType = RequestType.ShowButNotRun;
                }

                const parsedRequest = new ParsedRequest(line, requestType);
                parsedRequests.push(parsedRequest);
            }
        }

        return parsedRequests;
    }
}

class RequestDecomposer {
    constructor(private languageModelManager: LanguageModelManager) { }
    async decompose(parsedRequest: ParsedRequest): Promise<DecomposedRequest> {
        // Implement request decomposition logic
        // For example, you can call the initialDecomposition method to get the subtasks
        const subtasks = await this.initialDecomposition(parsedRequest);
        return new DecomposedRequest(parsedRequest, subtasks);
    }
    async initialDecomposition(parsedRequest: ParsedRequest): Promise<string[]> {
        const prompt = `Given the following user request: "${parsedRequest.rawRequest}", provide a list of potential commands or subtasks that may be relevant to solving the problem.`;
        const response = await this.languageModelManager.call("gpt-4", prompt);
        const commands = response.split('\n').map((cmd: string) => cmd.trim());
        return commands;
    }
}

// Command Generator
class CommandGenerator {
    constructor(
        private extensionManager: ExtensionManager,
        private languageModelManager: LanguageModelManager
    ) { }

    async refineCommandSelection(
        userRequest: string,
        initialCommands: string[]
    ): Promise<string[]> {
        const refinedCommands: string[] = [];

        for (const command of initialCommands) {
            const prompt = `Given the user request: "${userRequest}", and the suggested command: "${command}", provide more details about the command or confirm its relevance to the problem.`;
            const response = await this.languageModelManager.call("gpt-4", prompt);

            // Check if the response confirms the relevance of the command
            if (response.includes("relevant") || response.includes("appropriate")) {
                refinedCommands.push(command);
            }
        }

        return refinedCommands;
    }
    async generateCommands(refinedCommands: string[]): Promise<ICommand[]> {
        const commands: ICommand[] = [];

        for (const refinedCommand of refinedCommands) {
            const registeredCommands = this.extensionManager.getCommands();
            const command = registeredCommands.find((cmd) => cmd.name === refinedCommand);

            if (command) {
                commands.push(command);
            }
        }

        return commands;
    }
}

// Command Executor
class CommandExecutor {
    constructor(private extensionManager: ExtensionManager) { }
    async executeCommands(commands: ICommand[]): Promise<any> {
        for (const command of commands) {
            try {
                const extension = this.extensionManager.getExtensionByName(command.name);
                if (extension) {
                    await extension.executeCommand(command, {});
                } else {
                    shell.exec(command.name);
                }
            } catch (error) {
                // Handle errors and recovery
                console.error(`Error executing command "${command.name}":`, error);
            }
        }
    }
}

// Task Monitor & Evaluator
class TaskMonitorAndEvaluator {
    monitor(): void {
        // Implement task monitoring logic
    }

    evaluate(): void {
        // Implement task evaluation logic
    }
}

// Learning & Optimization
class LearningAndOptimization {
    optimize(): void {
        // Implement optimization logic
    }

    learn(): void {
        // Implement learning logic
    }
}

// Error Handler & Recovery
class ErrorHandlerAndRecovery {
    handleError(error: Error): void {
        // Implement error handling logic
    }

    recover(): void {
        // Implement recovery logic
    }
}

class DataManager {
    private dataFolderPath: string;

    constructor() {
        this.dataFolderPath = path.join(process.cwd(), '.data');
        this.ensureDataFolderExists();
    }

    private ensureDataFolderExists(): void {
        if (!fs.existsSync(this.dataFolderPath)) {
            fs.mkdirSync(this.dataFolderPath);
        }
    }

    private getDataFilePath(key: string): string {
        return path.join(this.dataFolderPath, `${key}.txt`);
    }

    storeData(data: any): void {
        const key = hash(data);
        const dataFilePath = this.getDataFilePath(key);
        fs.writeFileSync(dataFilePath, JSON.stringify(data));
    }

    retrieveData(query: any): any {
        const key = hash(query);
        const dataFilePath = this.getDataFilePath(key);

        if (fs.existsSync(dataFilePath)) {
            const data = fs.readFileSync(dataFilePath, 'utf-8');
            return JSON.parse(data);
        } else {
            return null;
        }
    }
}


// User Interaction & Communication
class UserInteraction {
    updateProgress(progress: any): void {
        // Implement progress update logic
    }

    requestClarification(): void {
        // Implement clarification request logic
    }

    presentResults(results: any): void {
        // Implement result presentation logic
    }
}

// Extension Manager
class ExtensionManager {
    private extensions: IExtension[] = [];

    registerExtension(extension: IExtension): void {
        // Implement extension registration logic
        this.extensions.push(extension);
    }

    unregisterExtension(extensionName: string): void {
        // Implement extension unregistration logic
        this.extensions = this.extensions.filter(
            (extension) => extension.name !== extensionName
        );
    }

    getCommands(): ICommand[] {
        // Implement command retrieval logic
        const commands: ICommand[] = [];
        this.extensions.forEach((extension) => {
            commands.push(...extension.registerCommands());
        });
        return commands;
    }

    getExtensionByName(extensionName: string): IExtension | undefined {
        // Implement extension retrieval logic by name
        return this.extensions.find((extension) => extension.name === extensionName);
    }
}

class ProblemSolverApp {
    // ...
    constructor(
        private requestParser: RequestParser,
        private requestDecomposer: RequestDecomposer,
        private commandGenerator: CommandGenerator,
        private commandExecutor: CommandExecutor,
        private taskMonitorAndEvaluator: TaskMonitorAndEvaluator,
        private learningAndOptimization: LearningAndOptimization,
        private errorHandlerAndRecovery: ErrorHandlerAndRecovery,
        private dataManager: DataManager,
        private userInteraction: UserInteraction,
        private extensionManager: ExtensionManager,
        private languageModelManager: LanguageModelManager
    ) { }

    async solve(userRequest: string): Promise<any> {
        try {
            // Parse the user request
            const parsedRequests = this.requestParser.parse(userRequest);

            for (const parsedRequest of parsedRequests) {
                // Perform initial decomposition using OpenAI
                const initialCommands = await this.requestDecomposer.initialDecomposition(
                    parsedRequest
                );

                // Refine command selection using OpenAI
                const refinedCommands = await this.commandGenerator.refineCommandSelection(
                    userRequest,
                    initialCommands
                );

                // Generate ICommand objects for the refined commands
                const commands = await this.commandGenerator.generateCommands(refinedCommands);

                // Execute the commands
                await this.commandExecutor.executeCommands(commands);

                // Monitor, evaluate, optimize, and learn
                // ...
            }

            // Handle user interaction and communication
            // ...
        } catch (error) {
            // Handle errors and recovery
            // ...
        }
    }
}

// Initialize your ProblemSolverApp and other required instances here
// Instantiate the managers
const languageModelManager = new LanguageModelManager();
const gpt4LanguageModel = new GPT4LanguageModel();
languageModelManager.registerLanguageModel(gpt4LanguageModel);

const requestParser = new RequestParser();
const requestDecomposer = new RequestDecomposer(languageModelManager);
const extensionManager = new ExtensionManager();
const commandGenerator = new CommandGenerator(extensionManager, languageModelManager);
const commandExecutor = new CommandExecutor(extensionManager);
const taskMonitorAndEvaluator = new TaskMonitorAndEvaluator();
const learningAndOptimization = new LearningAndOptimization();
const errorHandlerAndRecovery = new ErrorHandlerAndRecovery();
const dataManager = new DataManager();
const userInteraction = new UserInteraction();

// Create a new instance of ProblemSolverApp
const problemSolverApp = new ProblemSolverApp(
    requestParser,
    requestDecomposer,
    commandGenerator,
    commandExecutor,
    taskMonitorAndEvaluator,
    learningAndOptimization,
    errorHandlerAndRecovery,
    dataManager,
    userInteraction,
    extensionManager,
    languageModelManager
);

const main = async () => {
    const argv = yargs(hideBin(process.argv)).option('task', {
        alias: 't',
        type: 'string',
        description: 'Task to be solved',
    }).argv;

    if ((argv as any).task) {
        // If the user passes a task as a script parameter, solve the task
        await problemSolverApp.solve((argv as any).task);
    } else {
        // If the user just calls the script, gather user input using enquirer
        while (true) {
            const response: any = await prompt({
                type: 'input',
                name: 'task',
                message: 'Enter a task to solve or type ~ or q to quit:',
            });

            if (response.task === '~' || response.task === 'q') {
                console.log('Goodbye!');
                break;
            } else {
                // Attempt to solve the task
                await problemSolverApp.solve(response.task);
            }
        }
    }
};

main();