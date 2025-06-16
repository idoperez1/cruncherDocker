import { ChildProcess } from 'child_process';
import { isIpcMessage } from './ipc';

/**
 * Helper to request the server process for a value and wait for a response.
 * @param serverProcess The child process to communicate with
 * @param request The request object to send
 * @param responseType The expected response type string
 */
export function requestFromServer<T>(serverProcess: ChildProcess | null, request: object, responseType: string): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!serverProcess) return reject(new Error('Server process is not running'));
    const handler = (msg: unknown) => {
      if (isIpcMessage(msg) && msg.type === responseType) {
        serverProcess.off('message', handler);
        resolve(msg as T);
      }
    };
    serverProcess.on('message', handler);
    serverProcess.send?.(request);
  });
}
