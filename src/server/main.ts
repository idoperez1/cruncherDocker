import { ResponseHandler } from '~lib/networkTypes';
import { createSignal } from '~lib/utils';
import { getServer, setupEngine } from '../lib/websocket/server';
import { getRoutes, newUrlNavigationMessage } from '../plugins_engine/router';
import log from 'electron-log/main';

process.title = "cruncher-server";

log.initialize();
Object.assign(console, log.functions);

export let messageSender: ResponseHandler | undefined = undefined;
export const messageSenderReady = createSignal();

export const initializeServer = async () => {
    // get free port
    const serverContainer = await getServer();
    console.log(`Server is running on port ${serverContainer.port}`);
    // messageSender = getWebsocketMessageSender(serverContainer);
    messageSender = serverContainer;
    messageSenderReady.signal();
    const routes = await getRoutes(serverContainer);
    await setupEngine(serverContainer, routes);

    return {
        serverContainer,
        port: serverContainer.port,
        messageSender,
        messageSenderReady
    };
};

export const sendUrlNavigationMessage = (url: string) => {
    if (!messageSender) {
        console.warn("Message sender is not initialized yet, cannot handle open-url event");
        return;
    }
    messageSender.sendMessage(newUrlNavigationMessage(url));
};

// Define a type for IPC messages
interface IPCMessage {
    type: string;
    [key: string]: unknown;
}

const send = (message: IPCMessage) => {
    if (process.send) {
        process.send(message);
    } else {
        console.warn("Process send function is not available");
    }
};

// If this file is run directly, start the server and listen for IPC messages
if (require.main === module) {
    (async () => {
        const serverData = await initializeServer();
        send({ type: 'ready', port: serverData.port });

        // Generic IPC message handler for process communication
        process.on('message', async (msg: IPCMessage) => {
            if (!msg || typeof msg !== 'object' || !('type' in msg)) return;

            const handlers = {
                getPort: () => {
                    send({ type: 'port', port: serverData.port });
                },
                getVersion: () => {
                    send({ type: 'version', version: process.env.npm_package_version || 'unknown' });
                },
                navigateUrl: (msg: IPCMessage) => {
                    if (typeof msg.url === 'string') sendUrlNavigationMessage(msg.url);
                }
            } as const;

            console.log(`Received IPC message: ${msg.type}`, msg);
            if (!(msg.type in handlers)) {
                console.warn(`No handler for message type: ${msg.type}`);
                return;
            }

            const handler = handlers[msg.type as keyof typeof handlers];
            handler(msg);
        });
    })();
}
