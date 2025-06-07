import { useEffect, useMemo, useRef, useState } from "react";
import { useAsync } from "react-use";
import {
  QueryBatchDoneSchema,
  QueryJobUpdatedSchema,
} from "src/plugins_engine/protocol_out";
import { PluginInstance } from "src/plugins_engine/types";
import z from "zod";
import { QueryProvider } from "~core/common/interface";
import { notifyError } from "~core/notifyError";
import { createSignal } from "~lib/utils";
import {
  getWebsocketConnection,
  invokeAsyncRequest as originalAsyncInvoke,
  invokeSyncRequest as originalSyncInvoke,
  SubscribeOptions,
} from "~lib/websocket/client";
import { ControllerProviderContext } from "./search";
import type {
  AsyncInvokeWebSocketHandler,
  InvokeWebSocketHandler,
} from "./websocket_messages";

const invokeSyncRequestTyped: InvokeWebSocketHandler = (ws, method, params) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return originalSyncInvoke(ws, method, params) as any;
};

const invokeAsyncRequestTyped: AsyncInvokeWebSocketHandler = (
  ws,
  message,
  params
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return originalAsyncInvoke(ws, message, params) as any;
};

let selectedPlugin: PluginInstance | undefined = undefined;

export const WebsocketProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const readySignal = useRef(createSignal());
  const getPort = useAsync(async () => {
     return await window.electronAPI.getPort();
  }, []);

  const [wsServer, setWsServer] = useState<ReturnType<typeof getWebsocketConnection>>();

  useEffect(() => {
    if (getPort.loading || !getPort.value) {
      return;
    }

    const server =  getWebsocketConnection(`ws://localhost:${getPort.value}`);

    setWsServer(server);

    return () => {
      server.close(); // Clean up the WebSocket connection when the component unmounts
    }
  }, [getPort]);

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!wsServer) {
      return;
    }

    const ws = wsServer;
    const cancelReady = ws.onReady(async () => {
      try {
        console.log("WebSocket connection established");

        const response = await invokeSyncRequestTyped(
          ws,
          "getSupportedPlugins",
          {}
        );
        console.log("Supported plugins:", response);

        const initializedPlugins = await invokeSyncRequestTyped(
          ws,
          "getInitializedPlugins",
          {}
        );
        if (initializedPlugins.length === 0) {
          console.warn(
            "No plugins initialized, initializing default plugin..."
          );
          notifyError(
            "No plugins initialized",
            new Error(
              "No plugins initialized, please add ~/.config/cruncher/cruncher.config.yaml file"
            )
          );
          return;
        }

        selectedPlugin = initializedPlugins[0];
      } finally {
        console.log("WebSocket is ready, signaling...");
        readySignal.current.signal();
        setIsInitialized(true);
      }
    });

    const cancelOnClose = ws.onClose(() => {
      console.warn("WebSocket connection closed. Reconnecting...");
      selectedPlugin = undefined;
      readySignal.current.reset();
      // TODO: cancel all subscriptions and reset state
      //   unsub(); // Unsubscribe from the previous subscription
      //   setup(); // Reinitialize the WebSocket connection
      setIsInitialized(false);
    });

    return () => {
      cancelReady();
      cancelOnClose();
    };
  }, [wsServer]);

  const queryProvider = useMemo(() => {
    if (!wsServer) {
      return;
    }

    const ws = wsServer;
    return {
      waitForReady: async () => {
        return await readySignal.current.wait();
      },
      getControllerParams: async () => {
        await readySignal.current.wait({
          timeout: 5000, // Wait for up to 5 seconds for the WebSocket to be ready
        });
        if (!selectedPlugin) {
          throw new Error(
            "No plugin selected. Please ensure that at least one plugin is initialized."
          );
        }

        return await invokeSyncRequestTyped(ws, "getControllerParams", {
          instanceId: selectedPlugin.id,
        });
      },
      query: async (params, searchTerm, queryOptions) => {
        await readySignal.current.wait({
          timeout: 5000, // Wait for up to 5 seconds for the WebSocket to be ready
        });
        if (!ws) {
          throw new Error(
            "WebSocket connection is not established. Please wait for the WebSocket to be ready."
          );
        }
        if (!selectedPlugin) {
          throw new Error(
            "No plugin selected. Please ensure that at least one plugin is initialized."
          );
        }

        const job = await invokeSyncRequestTyped(ws, "runQuery", {
          instanceId: selectedPlugin.id,
          controllerParams: params,
          searchTerm,
          queryOptions: {
            fromTime: queryOptions.fromTime,
            toTime: queryOptions.toTime,
            limit: queryOptions.limit,
          },
        });
        console.log("Query job started:", job);

        const unsubscribeBatchHandler = ws.subscribe(QueryBatchDoneSchema, {
          predicate: (batchMessage) => batchMessage.payload.jobId === job.id,
          callback: (batchMessage) => {
            queryOptions.onBatchDone(batchMessage.payload.data);
          },
        });

        // setup cancel token
        const cancelToken = queryOptions.cancelToken;
        cancelToken.addEventListener("abort", () => {
          console.log(`Query job ${job.id} cancelled`);
          // Here we can handle the cancellation logic if needed
          // window.electronAPI.query.cancel(job.id);

          invokeSyncRequestTyped(ws, "cancelQuery", {
            taskId: job.id,
          });
        });

        return new Promise((resolve, reject) => {
          if (!ws) {
            throw new Error(
              "WebSocket connection is not established. Please wait for the WebSocket to be ready."
            );
          }

          const unsubscribeJobUpdateHandler = ws.subscribe(
            QueryJobUpdatedSchema,
            {
              predicate: (jobUpdateMessage) =>
                jobUpdateMessage.payload.jobId === job.id,
              callback: (jobUpdateMessage) => {
                const jobUpdate = jobUpdateMessage.payload;
                if (jobUpdate.status === "completed") {
                  console.log(`Job ${jobUpdate.jobId} completed`);
                  resolve();
                } else {
                  console.log(
                    `Job ${jobUpdate.jobId} updated: ${jobUpdate.status}`
                  );
                  // You can handle other statuses if needed
                  reject(
                    new Error(
                      `Query job ${jobUpdate.jobId} failed with status: ${jobUpdate.status}`
                    )
                  );
                }
                unsubscribeBatchHandler();
                unsubscribeJobUpdateHandler();
              },
            }
          );
        });
      },
    } satisfies QueryProvider;
  }, [wsServer]);

  const subscribeToMessages = <T extends z.ZodTypeAny>(
    schema: T,
    options: SubscribeOptions<T>
  ) => {
    if (!wsServer) {
      throw new Error("WebSocket connection is not ready");
    }

    const ws = wsServer;
    const unsub = ws.subscribe(schema, options);

    return () => {
      unsub(); // Unsubscribe from the WebSocket messages
    };
  };

  if (!isInitialized) {
    return <div>Loading WebSocket connection...</div>;
  }

  return (
    <ControllerProviderContext.Provider
      value={{
        provider: queryProvider,
        subscribeToMessages: subscribeToMessages,
      }}
    >
      {children}
    </ControllerProviderContext.Provider>
  );
};
