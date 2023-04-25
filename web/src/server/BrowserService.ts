import puppeteer from 'puppeteer';

type Page = any;
type PuppereerCommand = {
    command: string,
    args: any[]
}

async function withPage(url: string, callback: (page: any) => any) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url);
    const result = await callback(page);
    await browser.close();
    return result;
}

async function executeCommands(url: string, commands: PuppereerCommand[]) {
    const executeCommandsOnPage = async (page: Page, commands: PuppereerCommand[]) => {
        for (const command of commands) {
            await page[command.command](...command.args);
        }
    }
    await withPage(url, async (page: Page) => {
        await executeCommandsOnPage(page, commands);
    });
}

module.exports = {
    withPage,
    executeCommands
};