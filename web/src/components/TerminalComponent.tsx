// terminal component uses xterm and xterm-addon-fit to create a terminal that can be used to interact with the container
// it also uses xterm-addon-web-links to make links clickable

import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';

interface TerminalComponentProps {
    containerId: string;
    containerName: string;
    containerStatus: string;
    containerImage: string;
    containerCommand: string;
}

const TerminalComponent: React.FC<TerminalComponentProps> = ({ containerId, containerName, containerStatus, containerImage, containerCommand }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    useEffect(() => {
        if (terminalRef.current) {
            const terminal = new Terminal({
                cursorBlink: true,
                fontSize: 14,
                fontFamily: 'monospace',
                theme: {
                    background: '#1e1e1e',
                    foreground: '#d4d4d4',
                },
            });
            terminal.loadAddon(fitAddon);
            terminal.loadAddon(webLinksAddon);
            terminal.open(terminalRef.current);
            fitAddon.fit();
            const ws = new WebSocket(`ws://localhost:8080/containers/${containerId}/exec?command=${containerCommand}&stdout=1&stderr=1`);
            ws.onopen = () => {
                terminal.write(`\r\n${containerName} ${containerStatus} ${containerImage}\r\n`);
            };
            ws.onmessage = (event) => {
                terminal.write(event.data);
            };
            ws.onerror = () => {
                terminal.write(`\r\n${containerName} ${containerStatus} ${containerImage}\r\n`);
            };
            ws.onclose = () => {
                terminal.write(`\r\n${containerName} ${containerStatus} ${containerImage}\r\n`);
            };
            return () => {
                ws.close();
            };
        }
    }, [containerId, containerName, containerStatus, containerImage, containerCommand, fitAddon, webLinksAddon]);

    return <div ref={terminalRef} />;
};
}