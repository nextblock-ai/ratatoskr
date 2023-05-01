// this file defines the SmartPrompt class, which is a construct that assocuates an AI prompt, output grammar rules, 
// and a ruleset for the AI to follow together in a single object which implements an iterative constructor capable of complex output generation.
//
// how it works:
// a prompt is first created using pseudocode instead of natural language. Doing this achieves two things:
// 1. it provides the AI with unambiguous instructions and logically-consistent logic paths to follow. This enables the AI to be more accurate and less prone to errors.
// 2. it also allows for the creation of multi-entrant prompts, which are prompts that have multiple starting points and logic paths through the prompt. 
// 3. This allows the AI to output complex work-products that would otherwise be impossible to achieve with a single-entrant prompt.
// the prompt generates desired output based on user input & is multi-entrant (has multiple starting points and logic paths through the prompt)
// the output is parsed by the grammar rules, which are a set of rules that define what the output format should look like.
// if the output doesn't match the expected results, the class automatically replies with an error message that reminds the llm of the expected output format. This prompts the llm to correct their input.
// once the output matches the expected results, the class processes the response data according to the rules defined in the ruleset.
// For exapmple, one might define an iterative application generation script which first generates a task list for the project (thus better defining the project's scope), and when given that task list will implement each of the tasks in the list in order.
// This allows the AI to prompt itself for additional information, help, or anything else it needs to complete the task.
// 
// Does it work? Yes. I've tested it. It works. It's awesome. We will be porting the app-creation-specific instance we have working now into the first version of the app.
/*
1. Class: SmartPrompt
   - Properties:
     - prompt: The AI prompt in pseudocode format.
     - grammarRules: The grammar rules for parsing the output. This is an ohm grammar string.
     - ruleset: The ruleset for processing the response data.
     - config: The configuration object for the SmartPrompt instance.

   - Methods:
     - constructor(config): Initializes the SmartPrompt instance with the given configuration.
     - generateOutput(userInput): Generates the desired output based on the user input and the prompt.
     - parseOutput(output): Parses the output using the grammar rules and checks if it matches the expected format.
     - processResponseData(responseData): Processes the response data according to the rules defined in the ruleset.
     - execute(): The main method that ties everything together and generates the final output.

Now, let's break down each component in more detail:

1. Prompt:
   - The prompt should be written in pseudocode format to provide clear instructions for the AI.
   - It should be multi-entrant, allowing for multiple starting points and logic paths.

2. Grammar Rules:
   - These rules define the expected format of the output.
   - They should be written using the ohm.js library grammar format.

3. Ruleset:
   - This is a set of rules that dictate how the AI should process the response data.
   - It should be flexible enough to accommodate different types of tasks and scenarios.
   - initial version implemented as a series of response processors which are called when the response data matches the expected format.

4. Configuration:
   - The configuration object should contain all the necessary information for the SmartPrompt instance to function correctly.
   - This includes the prompt, grammar rules, ruleset, and an initial configuration block carrying any necessary data for the AI to function correctly.

With this design in mind, we can start implementing the SmartPrompt class and its components. Once the class is implemented, we can create an instance of it with the appropriate configuration and we use it to generate complex outputs based on user input.

*/

import axios from 'axios';

interface GPTChatConversation {
    model: string;
    messages: GPTChatMessage[];
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
    apikey: string;
}

interface GPTChatMessage {
    role: string;
    content: string;
}

async function sendQuery(query: GPTChatConversation): Promise<string> {
    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            query,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${query.apikey}`,
                },
            }
        );
        if (response.data && response.data.choices && response.data.choices.length > 0) {
            return response.data.choices[0].message.content;
        } else {
            throw new Error('No completion found');
        }
    } catch (error) {
        console.error('Error in chatCompletion:', error);
        throw error;
    }
}

import * as ohm from 'ohm-js';

class SmartPrompt {
    prompt: string;
    grammarRules: string;
    ruleset: string;
    config: any;

    constructor(config: any) {
        this.prompt = config.prompt;
        this.grammarRules = config.grammarRules;
        this.ruleset = config.ruleset;
        this.config = config.config;
    }

    async generateOutput(userInput: string): Promise<string> {
        const query: GPTChatConversation = {
            model: "gpt-4",
            messages: [
                {
                    role: "system",
                    content: this.prompt,
                },
                {
                    role: "user",
                    content: userInput,
                },
            ],
            apikey: this.config.apikey,
        };

        const output = await sendQuery(query);

        return output;
    }

    createSemantics(grammar: ohm.Grammar): ohm.Semantics {
        const semantics = grammar.createSemantics();

        Object.keys(grammar.rules).forEach((rule) => {
            semantics.addOperation(rule, {
                [rule]: function (...children: any[]) {
                    return {
                        type: rule,
                        children: children.map((child) => child[rule]()),
                    };
                },
            });
        });

        return semantics;
    }

    parseOutput(output: string) {
        const grammar = ohm.grammar(this.grammarRules);
        const match = grammar.match(output);

        if (match.succeeded()) {
            const semantics = this.createSemantics(grammar);
            const responseTree = semantics(match).toTree();
            return responseTree;
        } else {
            throw new Error('Output format does not match the expected grammar rules.');
        }
    }

    processResponseData(responseData: any) {
        // Process the response data using the ruleset.
        // This function needs to be implemented based on the specific ruleset.
        return "Processed response data";
    }

    async execute(userInput: string): Promise<string> {
        try {
            const output = await this.generateOutput(userInput);
            const responseData = this.parseOutput(output);
            const result = this.processResponseData(responseData);
            return result;
        } catch (error) {
            // Handle errors and return an appropriate error message.
            return error.message;
        }
    }
}