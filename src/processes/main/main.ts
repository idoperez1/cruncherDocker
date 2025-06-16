import { compare } from 'compare-versions';
import { app, BrowserWindow, dialog, ipcMain, MessagePortMain, shell, UtilityProcess } from 'electron';
import log from 'electron-log/main';
import started from 'electron-squirrel-startup';
import path from 'node:path';
import { fork, ChildProcess } from 'child_process';
import { requestFromServer } from './utils/requestFromServer';
import chokidar, { FSWatcher } from 'chokidar';
import { utilityProcess, MessageChannelMain } from 'electron';

// Optional, initialize the logger for any renderer process
log.initialize();
Object.assign(console, log.functions);

const updateServer = "https://cruncher-upstream.vercel.app";
const repoHome = "https://github.com/IamShobe/cruncher"
const feedChannel = `${process.platform}_${process.arch}`;
const updateUrl = `${updateServer}/update/${feedChannel}/0.0.0`

console.log("feed URL for autoUpdater:", updateUrl);

const version = app.getVersion();
console.log(`Cruncher version: ${version}`);

const checkForUpdates = async () => {
  console.log("Checking for updates...");
  const fetchResponse = await fetch(updateUrl)
  if (!fetchResponse.ok) {
    console.error("Failed to fetch update information:", fetchResponse.statusText);
    return;
  }

  const respData = await fetchResponse.json();

  const latestVersion = respData.name;
  const latestAvailableVersion = latestVersion.trim().replace(/^v/, '');

  if (compare(latestAvailableVersion, version, '>')) {
    console.log(`A new version is available: ${latestVersion}`);
    dialog.showMessageBox({
      type: 'info',
      buttons: ['Go to release page', 'Later'],
      title: 'Application Update',
      message: `Version ${latestVersion} is available!`,
      detail: 'A new version of Cruncher is available. Would you like to go to the release page to download it?'
    }).then((returnValue) => {
      if (returnValue.response === 0) {
        const releaseUrl = `${repoHome}/releases/tag/${latestVersion}`;
        shell.openExternal(releaseUrl);
      }
    })
  }
}

checkForUpdates()

// log workdir 
console.log(`Current working directory: ${process.cwd()}`);

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('cruncher', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('cruncher')
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}
let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, 'icons', 'png', 'icon.png'),
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
};

function isDev() {
  return !app.getAppPath().includes('app.asar');
}

let serverProcess: UtilityProcess | null = null;
let serverReady: Promise<void> | null = null;
let serverWatcher: FSWatcher | null = null;
let port: MessagePortMain | null = null;

function startServerProcess() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }

  console.log("Starting server process...");
  serverProcess = utilityProcess.fork(
    path.join(__dirname, 'server.js'),
    [],
    {
      execArgv: isDev() ? ['--inspect=9230'] : undefined,
    }
  );

  // check if forked process is running
  serverProcess.on('error', (err) => {
    console.error('Failed to start server process:', err);
    dialog.showErrorBox('Server Error', `Failed to start server process: ${err}`);
    serverProcess = null;
    serverReady = null;
  });
  const { port1, port2 } = new MessageChannelMain();
  serverProcess.postMessage({ type: 'init' }, [port1]);
  serverReady = requestFromServer<void>(
    port2,
    {}, // No request message needed, just wait for the first 'ready' message
    'ready'
  );
  port2.start();
  port = port2;
}

// Cleanup on quit
app.on('before-quit', () => {
  if (serverProcess) {
    console.log('Killing child process...');
    serverProcess.kill(); // or .kill('SIGTERM')
  }
});

if (isDev()) {
  const serverJsPath = path.join(__dirname, 'server.js');
  if (!serverWatcher) {
    serverWatcher = chokidar.watch(serverJsPath, { ignoreInitial: true });
    serverWatcher.on('change', () => {
      log.info('Detected change in server.js, restarting server process...');
      startServerProcess();
    });
  }
}

const ready = async () => {
  if (!serverProcess) startServerProcess();
  console.log("Waiting for server process to be ready...");
  await serverReady;

  // --- IPC Handlers ---

  ipcMain.handle('getPort', async () => {
    const msg = await requestFromServer<{ type: string; port: number }>(port, { type: 'getPort' }, 'port');
    return msg.port;
  });

  ipcMain.handle('getVersion', async () => {
    try {
      const msg = await requestFromServer<{ type: string; version: string }>(port, { type: 'getVersion' }, 'version');
      return { tag: msg.version, isDev: isDev() };
    } catch {
      return { tag: 'unknown', isDev: isDev() };
    }
  });

  createWindow();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, commandLine: string[]) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
    serverReady?.then(() => {
      port?.postMessage({ type: 'navigateUrl', url: commandLine[1] });
    });
  })

  // Create mainWindow, load the rest of the app, etc...
  app.whenReady().then(() => {
    ready();
  })

  app.on('open-url', (event, url) => {
    serverReady?.then(() => {
      port?.postMessage({ type: 'navigateUrl', url });
    });
  })
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
