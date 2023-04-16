const {
    loadFiles,
    createConversation,
    getCompletion,
    updateFile,
    processCommand,
} = require("../code");

// Mock the fs and path modules
jest.mock("fs-extra");
jest.mock("path");

// Mock the OpenAIApi module
const { OpenAIApi, Configuration } = require("openai");
jest.mock("openai");

describe("loadFiles", () => {
    beforeEach(() => {
        // Reset the mocked functions before each test
        fs.readdir.mockReset();
        fs.lstatSync.mockReset();
        fs.readFile.mockReset();
        path.join.mockReset();
    });

    it("should load files from the target folder", async () => {
        // Mock the fs.readdir function to return a list of file names
        fs.readdir.mockResolvedValue([
            "file1.js",
            "file2.js",
            "__tests__",
            "file3_ratatoskr_exclude.js",
        ]);

        // Mock the fs.lstatSync function to return an object with isFile method
        fs.lstatSync.mockReturnValue({
            isFile: () => true,
        });

        // Mock the fs.readFile function to return the file content
        fs.readFile.mockImplementation((filePath, encoding) => {
            if (filePath.includes("file1.js")) {
                return "File 1 content";
            } else if (filePath.includes("file2.js")) {
                return "File 2 content";
            } else if (filePath.includes("file3_ratatoskr_exclude.js")) {
                return "File 3 content\nratatoskr:exclude";
            }
        });

        // Mock the path.join function to return the file path
        path.join.mockImplementation((dir, file) => `${dir}/${file}`);

        const files = await loadFiles("targetFolder");

        expect(files).toEqual([
            { name: "file1.js", content: "File 1 content" },
            { name: "file2.js", content: "File 2 content" },
        ]);
    });
});

describe("createConversation", () => {
    it("should create a conversation with the contents of the loaded files", async () => {
        const files = [
            { name: "file1.txt", content: "This is file1 content" },
            { name: "file2.txt", content: "This is file2 content" },
        ];

        const conversation = await createConversation(files);

        // Check if the initial message is present
        expect(conversation[0].role).toBe("system");
        expect(conversation[0].content).toContain("You are an AI assistant");

        // Check if the file contents are present in the conversation
        expect(conversation[1].role).toBe("system");
        expect(conversation[1].content).toContain("The content of file1.txt");
        expect(conversation[1].content).toContain("This is file1 content");

        expect(conversation[2].role).toBe("system");
        expect(conversation[2].content).toContain("The content of file2.txt");
        expect(conversation[2].content).toContain("This is file2 content");

        // Check if the reminder message is present
        expect(conversation[3].role).toBe("user");
        expect(conversation[3].content).toContain("RESPOND ONLY WITH CONTROL STATEMENTS OR ECHO STATEMENTS");
    });
});

describe("getCompletion", () => {
    beforeEach(() => {
        // Set up the OpenAIApi mock
        const configuration = new Configuration({ apiKey: "test-api-key" });
        const openai = new OpenAIApi(configuration);
        openai.createChatCompletion = jest.fn().mockResolvedValue({
            data: {
                choices: [
                    {
                        message: {
                            content: "!edit file1.js \"searchPattern\" \"replacement\"",
                        },
                    },
                ],
            },
        });
    });

    it("should get completion from the OpenAI API", async () => {
        const messages = [
            { role: "system", content: "Initial message" },
            { role: "user", content: "User message" },
        ];

        const completion = await getCompletion(messages);

        expect(completion).toEqual("!edit file1.js \"searchPattern\" \"replacement\"");
        expect(OpenAIApi.prototype.createChatCompletion).toHaveBeenCalledTimes(1);
        expect(OpenAIApi.prototype.createChatCompletion).toHaveBeenCalledWith({
            model: "gpt-4",
            messages,
            max_tokens: 2048,
            temperature: 0.05,
        });
    });
});

describe("updateFile", () => {
    beforeEach(() => {
        // Reset the mocks before each test
        fs.writeFileSync.mockReset();
        path.join.mockReset();
    });

    it("should update the file content and save it", async () => {
        // Mock the path.join function to return a fake file path
        path.join.mockImplementation(() => "fake/file/path");

        // Mock the fs.writeFileSync function to simulate file writing
        fs.writeFileSync.mockImplementation((filePath, content, encoding) => {
            // You can add any logic here to simulate the file writing behavior
        });

        const fileName = "test.txt";
        const newContent = "This is the updated content.";

        await updateFile(fileName, newContent);

        // Check if the path.join function was called with the correct arguments
        expect(path.join).toHaveBeenCalledWith(__dirname, fileName);

        // Check if the fs.writeFileSync function was called with the correct arguments
        expect(fs.writeFileSync).toHaveBeenCalledWith(
            "fake/file/path",
            newContent,
            "utf-8"
        );
    });
});

describe("processCommand", () => {
    let files;

    beforeEach(() => {
        files = [
            {
                name: "file1.txt",
                content: "This is the content of file1.",
            },
            {
                name: "file2.txt",
                content: "This is the content of file2.",
            },
        ];
    });

    it("should process the command and update the file content", async () => {
        const command = '!edit file1.txt "content of file1" "modified content of file1"';
        const expectedContent = "This is the modified content of file1.";

        // Mock the updateFile function to avoid actually updating the file
        updateFile = jest.fn();

        const result = await processCommand(command, files);
        const updatedFile = files.find((f) => f.name === "file1.txt");

        expect(updateFile).toHaveBeenCalledWith("file1.txt", expectedContent);
        expect(updatedFile.content).toBe(expectedContent);
        expect(result).toContain(`File file1.txt updated successfully.`);
    });

    it("should return an error message if the file is not found", async () => {
        const command = '!edit non_existent_file.txt "content" "modified content"';
        const result = await processCommand(command, files);

        expect(result).toContain(`File non_existent_file.txt not found.`);
    });
});
