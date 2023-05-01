
const screen = blessed.screen({
    smartCSR: true
});

const initialPrompt = blessed.textarea({
    top: 0,
    height: "25%",
    width: '33%',
    border: { type: 'line' },
    inputOnFocus: true
});

const chatSection = blessed.box({
    left: 0,
    top: "25%",
    width: '33%',
    height: '65%',
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
    height: '40%',
    padding: { left: 1, right: 1 },
    border: { type: 'line' }
});

const textField = blessed.textarea({
    bottom: 0,
    height: "10%",
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
}

const setBashInputSection = (input) => {
    bashInputSection.setContent(input);
}

const setBashOutputSection = (output) => {
    bashOutputSection.setContent(output);
}

const renderScreen = (messages, input, output) => {
    setChatSection(messages);
    setBashInputSection(input);
    setBashOutputSection(output);
}

const setHandleTextInputChanged = (handleTextInputChanged) => {
    textField.on('keypress', (ch, key) => {
        // allow shift + enter to add a line - enter should submit
        if (key.name === 'enter' && key.shift) {
            textField.setValue(textField.getValue() + '\n');
            return;
        }

        if (key.name === 'enter') {
            handleTextInputChanged(textField.getValue());
            textField.setValue('');
            return;
        }
    });
}

const setInitialPromptChanged = (handleInitialPromptChanged) => {
    initialPrompt.on('keypress', (ch, key) => handleInitialPromptChanged);
}

const render = () => screen.render();

module.exports = {
    render,
    renderScreen,
    setHandleTextInputChanged,
    setInitialPromptChanged
}