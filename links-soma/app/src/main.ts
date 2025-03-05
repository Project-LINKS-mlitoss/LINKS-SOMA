import {
  app,
  BrowserWindow,
  ipcMain,
  session,
  Menu,
  type MenuItemConstructorOptions,
  type MenuItem,
} from "electron";
import { join } from "path";
import os from "os";
import { readdirSync, readFileSync } from "fs";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { db } from "./utils/db";
import { ipcMainListeners } from "./ipc-main-listeners";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CJS環境で動くため
if (require("electron-squirrel-startup")) {
  app.quit();
}

const hono = new Hono();
const port = 3000;

const isDev = process.env.NODE_ENV === "development";

const createMenu = (mainWindow: BrowserWindow): void => {
  const template: Array<MenuItemConstructorOptions | MenuItem> = [
    {
      label: "ファイル",
      submenu: [
        {
          label: "終了",
          role: "quit",
          accelerator: "Alt+F4",
        },
      ],
    },
    {
      label: "表示",
      submenu: [
        {
          label: "再読み込み",
          accelerator: "CmdOrCtrl+R",
          click: () => mainWindow.webContents.reload(),
        },
        {
          label: "強制再読み込み",
          accelerator: "Shift+CmdOrCtrl+R",
          click: () => mainWindow.webContents.reloadIgnoringCache(),
        },
        { type: "separator" },
        {
          label: "実際のサイズ",
          role: "resetZoom",
          accelerator: "CmdOrCtrl+0",
        },
        {
          label: "拡大",
          role: "zoomIn",
          accelerator: "CmdOrCtrl+Plus",
        },
        {
          label: "縮小",
          role: "zoomOut",
          accelerator: "CmdOrCtrl+-",
        },
      ],
    },
    {
      label: "ウィンドウ",
      submenu: [
        {
          label: "最小化",
          role: "minimize",
          accelerator: "CmdOrCtrl+M",
        },
        {
          label: "ズーム",
          role: "zoom",
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

const createWindow = (): void => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
    },
  });

  if (os.platform() === "win32") {
    createMenu(mainWindow);
  }

  // Load the app
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    // In production, use Hono server
    const startURL = `http://localhost:${port}`;
    void mainWindow.loadURL(startURL);
  }

  // Open the DevTools when in development mode.
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
};

void app.whenReady().then(async () => {
  const migrationsFolder = isDev
    ? "drizzle"
    : join(process.resourcesPath, "drizzle");
  migrate(db, { migrationsFolder });

  if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    // Set up Hono server for production
    const distPath = join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`);

    // Serve static files
    hono.use("/*", serveStatic({ root: distPath }));

    // SPAのためのフォールバック設定を追加
    hono.get("*", (c) => {
      const html = readFileSync(join(distPath, "index.html"), "utf-8");
      return c.html(html);
    });

    // Start the server
    serve(
      {
        fetch: hono.fetch,
        port,
      },
      createWindow,
    );
  } else {
    createWindow();
  }

  // Register IPC main listeners
  Object.entries(ipcMainListeners).forEach(([channel, listener]) => {
    ipcMain.handle(channel, listener);
  });

  // React DevTool Path
  const reactDevToolExtensionPath = getReactDevToolsPath();

  // if React DevTool is not installed
  if (reactDevToolExtensionPath && isDev) {
    await session.defaultSession.loadExtension(reactDevToolExtensionPath);
  }

  app.on("activate", () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

const getReactDevToolsPath = (): string | null => {
  const devtoolsId = "fmkadmapgofadopljbjfkapdkoienihi";
  const platform = os.platform();

  switch (platform) {
    case "win32": {
      const winDevToolsInstallPath = `${process.env.LOCALAPPDATA}\\Google\\Chrome\\User Data\\Default\\Extensions\\${devtoolsId}\\`;
      const dirs = readdirSync(winDevToolsInstallPath);
      return join(winDevToolsInstallPath, dirs[0]);
    }
    case "darwin": {
      const macDevToolsInstallPath = `${os.homedir()}/Library/Application Support/Google/Chrome/Default/Extensions/${devtoolsId}/`;
      const macDirs = readdirSync(macDevToolsInstallPath);
      return join(macDevToolsInstallPath, macDirs[0]);
    }
    case "linux": {
      const linuxDevToolsInstallPath = `${os.homedir()}/.config/google-chrome/Default/Extensions/${devtoolsId}/`;
      const linuxDirs = readdirSync(linuxDevToolsInstallPath);
      return join(linuxDevToolsInstallPath, linuxDirs[0]);
    }
    default:
      return null;
  }
};
