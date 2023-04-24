import "dotenv/config";

import { OpenAIApi, Configuration } from "openai";
const configuration = new Configuration({ apiKey: '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' });
const openai = new OpenAIApi(configuration);

export async function getCompletion(messages: any, options = {
    model: 'gpt-4',
    max_tokens: 1024,
    temperature: 0.01,
}, requeryIncompletes = true): Promise<any> {
    const conversation = {
        model: 'gpt-4',
        messages,
        max_tokens: 1024,
        temperature: 0.01,
    }
    const _response: any[] = [];
    const _getResponse = () => _response.join('');
    const _isResponseJson = () => _getResponse().startsWith('{') || _getResponse().startsWith('[');
    const _isProperlyFormedJson = () => _isResponseJson() && (_getResponse().endsWith('}') || _getResponse().endsWith(']'));
    let isJson = false;

    const _query = async (conversation: { model?: string; messages: any; max_tokens?: number; temperature?: number; }, iter: number) => {

        let completion = await openai.createChatCompletion(conversation as any);
        completion = (completion.data.choices[0].message as any).content.trim();
        _response.push(completion);

        return new Promise((resolve): any => {
            const responseMessage = _getResponse();
            isJson = iter === 0 && _isResponseJson();
            if (isJson && requeryIncompletes) {
                if (_isProperlyFormedJson()) {
                    return resolve(responseMessage);
                } else {
                    conversation.messages.push({ role: 'assistant', content: completion });
                    return resolve(_query(conversation, iter + 1));
                }
            } else return resolve(responseMessage);
        });
    }
    const completion = await _query(conversation, 0);
    return completion;
};