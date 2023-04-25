const { createServer, IncomingMessage, ServerResponse } = require('http');
const { parse } = require('url');
const next = require('next');
const ws = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer((req: any, res: any) => {
        const parsedUrl = parse(req.url || '', true);
        handle(req, res, parsedUrl);
    });

    // const wss = new ws.Server({ server });

    // wss.on('connection', (ws: any, req: any) => {
    //     const containerId = req.url?.match(/containerId=([^&]+)/)?.[1];
    //     const containerCommand = req.url?.match(/command=([^&]+)/)?.[1];

    //     ws.on('message', (message: string) => {
    //         console.log(`Received message: ${message}`);
    //         // Handle incoming messages from the client, e.g., start container command, stop container command, etc.
    //     });

    //     ws.on('close', () => {
    //         console.log('WebSocket connection closed');
    //         // Perform cleanup tasks, e.g., stop container command, release resources, etc.
    //     });

    //     // Send a welcome message to the client
    //     ws.send('WebSocket connection established');
    // });

    server.listen(3000, (err?: Error) => {
        if (err) throw err;
        console.log('> Ready on http://localhost:3000');
    });
});