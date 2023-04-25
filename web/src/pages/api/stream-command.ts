// pages/api/events.js
import nextConnect from 'next-connect';
import { commandLoop } from '@/command';

const handler = nextConnect();

handler.get(async (req: any, res: any) => {

    // header for event-stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    // get the command from the query string
    const { command } = req.query;
    const writeData = (data: any) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    // run the command and send the output to the client
    await commandLoop(command, res, (data: any) => writeData({data}));
    // Clean up when the connection is closed
    req.on('close', () => {
        res.end();
    });

});

export default handler;