import { v4 as uuidv4 } from 'uuid';
import { GenericMessageSchema, SyncRequestIn, SyncResponsesSchema, WebsocketMessageCustomer } from "./types";
import { measureTime } from '~lib/utils';
import z from 'zod';
import { unpack, pack } from 'msgpackr';


export interface WebsocketClientWrapper {
    once: (consumer: WebsocketMessageCustomer) => void;
    sendMessage: (message: unknown) => void;
}

export const invokeAsyncRequest = (consumer: WebsocketClientWrapper, kind: string, payload?: unknown) => {
    const message = {
        type: kind,
        payload: payload,
    }
    consumer.sendMessage(message);
}


export const invokeSyncRequest = (consumer: WebsocketClientWrapper, kind: string, payload?: unknown) => {
    if (typeof kind !== 'string' || !kind.trim()) {
        throw new Error("Kind must be a non-empty string");
    }

    const requestId = uuidv4();
    const toWebServerPayload: SyncRequestIn = {
        type: "sync_request",
        kind,
        uuid: requestId,
        payload,
    };

    consumer.sendMessage(toWebServerPayload);

    // register a promise to wait for the response
    // remove the event listener after the response is received
    // to avoid memory leaks
    return new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Timeout waiting for response for request ${kind} with ID ${requestId}`));
        }, 10000); // 10 seconds timeout

        const handleResponse = (message: unknown) => {
            try {
                const response = SyncResponsesSchema.parse(message);
                if (response.type === "sync_response") {
                    resolve(response.payload);
                } else if (response.type === "sync_error") {
                    reject(new Error(response.payload.error));
                }
            } catch (error) {
                console.error('Error parsing response:', error);
                reject(new Error('Invalid response format'));
            } finally {
                clearTimeout(timeout); // Clear the timeout once we have a response
            }
        };

        const callback = (event: unknown) => handleResponse(event);
        consumer.once({
            shouldMatch: (message: unknown) => {
                const parsed = SyncResponsesSchema.safeParse(message)
                if (!parsed.success) {
                    return false;
                }

                return parsed.data.uuid === requestId
            },
            callback,
        })
    });
}


export type SubscribeOptions<T extends z.ZodTypeAny> = {
    predicate?: (message: z.infer<T>) => boolean;
    callback: (message: z.infer<T>) => void;
}

export const getWebsocketConnection = (url: string) => {
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";

    const consumers: WebsocketMessageCustomer[] = []; // Array to hold consumers

    ws.addEventListener('message', (event) => {
        try {
            const parsedRawMessage = measureTime("WebSocket message parsing", () => {
                return unpack(event.data)
            });
            if (!parsedRawMessage) {
                console.warn('Received empty or invalid message:', event.data);
                return;
            }

            // Check if the message is GenericMessageSchema compliant
            GenericMessageSchema.parse(parsedRawMessage);

            measureTime("WebSocket message processing", () => {
                // Notify all consumers about the received message
                consumers.forEach(consumer => {
                    try {
                        if (consumer.shouldMatch(parsedRawMessage)) {
                            consumer.callback(parsedRawMessage);
                        }
                    } catch (error) {
                        console.error('Error in consumer callback:', error);
                    }
                });
            })
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    const addConsumer = (consumer: WebsocketMessageCustomer) => {
        // Add a new consumer to the list
        consumers.push(consumer);
    };

    const removeConsumer = (consumer: WebsocketMessageCustomer) => {
        // Remove a consumer from the list
        const index = consumers.indexOf(consumer);
        if (index !== -1) {
            consumers.splice(index, 1);
        }
    }

    // TODO: should delete?
    const _subscribe = (shouldMatch: (message: unknown) => boolean, callback: (message: unknown) => void) => {
        const consumer: WebsocketMessageCustomer = {
            shouldMatch: shouldMatch,
            callback: callback,
        };
        addConsumer(consumer);

        return () => {
            removeConsumer(consumer);
        };
    }

    const subscribeMessage = <T extends z.ZodTypeAny>(schema: T, options: SubscribeOptions<T>) => {
        const consumer: WebsocketMessageCustomer = {
            shouldMatch: (message: unknown) => {
                const payload = schema.safeParse(message)
                if (!payload.success) {
                    return false;
                }

                const predicate = options.predicate ?? (() => true);

                const matches = predicate(payload.data);
                if (!matches) {
                    return false;
                }

                return true;
            },
            callback: (message: unknown) => {
                const parsedMessage = schema.parse(message);
                options.callback(parsedMessage);
            },
        };
        addConsumer(consumer);

        return () => {
            removeConsumer(consumer);
        };
    }

    return {
        sendMessage: (message: unknown) => {
            const serializedMessageBuffer = pack(message);
            ws.send(serializedMessageBuffer);
        },
        subscribe: subscribeMessage,
        once: (consumer: WebsocketMessageCustomer) => {
            const originalCallback = consumer.callback;
            consumer.callback = (message: unknown) => {
                try {
                    originalCallback(message);
                }
                finally {
                    // Remove the consumer after the first match
                    removeConsumer(consumer);
                }
            }

            addConsumer(consumer);
        },
        close: () => {
            ws.close();
            consumers.length = 0; // Clear all consumers
        },
        onReady: (callback: () => void) => {
            ws.addEventListener('open', callback);

            return () => {
                ws.removeEventListener('open', callback);
            }
        },
        onClose: (callback: () => void) => {
            ws.addEventListener('close', callback);

            return () => {
                ws.removeEventListener('close', callback);
            }
        },
    };
}