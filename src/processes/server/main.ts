import { ResponseHandler } from '~lib/networkTypes';
import { createSignal } from '~lib/utils';
import { getServer, setupEngine } from '~lib/websocket/server';
import { getRoutes, newUrlNavigationMessage } from './plugins_engine/router';
import log from 'electron-log/main';

process.title = "cruncher-server";

log.initialize();
Object.assign(console, log.functions);

let messageSender: ResponseHandler | undefined = undefined;

let serverContainer: Awaited<ReturnType<typeof getServer>> | undefined = undefined;
const messageSenderReady = createSignal();

const initializeServer = async () => {
    console.log("Initializing server...");
    // get free port
    serverContainer = await getServer();
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

const sendUrlNavigationMessage = (url: string) => {
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

console.log("Server process started, waiting for IPC messages...");
// If this file is run directly, start the server and listen for IPC messages
if (require.main === module) {
    (async () => {
        const serverData = await initializeServer();

        process.parentPort.on('message', (e) => {
            const [port] = e.ports
            port.on('message', (e) => {
                const msg = e.data as IPCMessage;
                if (!msg || typeof msg !== 'object' || !('type' in msg)) return;

                const handlers = {
                    getPort: () => {
                        port.postMessage({ type: 'port', port: serverData.port });
                    },
                    getVersion: () => {
                        port.postMessage({ type: 'version', version: process.env.npm_package_version || 'unknown' });
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
            })
            port.start()
            port.postMessage({ type: 'ready', port: serverData.port });
        })

    })();
}

// listen to signal to exit gracefully
process.on('SIGINT', () => {
    console.log("Received SIGINT, shutting down server...");
    serverContainer?.server.close((err) => {
        if (err) {
            console.error("Error shutting down server:", err);
        } else {
            console.log("Server shut down successfully.");
        }
    });

    process.exit(0);
})
