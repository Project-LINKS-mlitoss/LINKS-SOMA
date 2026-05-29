import {
  app,
  BrowserWindow,
  ipcMain,
  session,
  Menu,
  type MenuItemConstructorOptions,
  type MenuItem,
  dialog,
} from "electron";
import { basename, dirname, isAbsolute, join } from "path";
import os from "os";
import { readdirSync, readFileSync, existsSync, statSync } from "fs";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { db } from "./db/client";
import { ipcMainListeners } from "./ipc-main-listeners";
import { mainProcessLogger } from "./shared/utils/main-process-logger";
import { withIpcErrorHandling } from "./shared/utils/ipc-error-handler";
import { isFirstLaunch, presetModels } from "./launch";

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
        { type: "separator" },
        {
          label: "開発者ツール",
          accelerator: "CmdOrCtrl+Shift+I",
          click: () => mainWindow.webContents.toggleDevTools(),
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

// 親ディレクトリを辿って .git を探し、worktree root の basename と現在のブランチを返す。
// .git がファイル（git worktree）の場合は `gitdir:` を解決して HEAD を読む。
// detached HEAD は 7 桁の短縮 SHA にフォールバック。git が無い環境でもクラッシュしない。
const readGitInfo = (
  startDir: string,
): { worktreeRoot: string; branch: string | undefined } => {
  for (let dir = startDir; ; ) {
    const gitPath = join(dir, ".git");
    if (existsSync(gitPath)) {
      let gitDir = gitPath;
      try {
        if (statSync(gitPath).isFile()) {
          const gitdirMatch = readFileSync(gitPath, "utf8").match(
            /^gitdir:\s*(.+)$/m,
          );
          if (!gitdirMatch) return { worktreeRoot: dir, branch: undefined };
          const parsed = gitdirMatch[1].trim();
          gitDir = isAbsolute(parsed) ? parsed : join(dir, parsed);
        }
        const head = readFileSync(join(gitDir, "HEAD"), "utf8").trim();
        const refMatch = head.match(/^ref: refs\/heads\/(.+)$/);
        if (refMatch) return { worktreeRoot: dir, branch: refMatch[1] };
        if (/^[0-9a-f]{7,40}$/.test(head)) {
          return { worktreeRoot: dir, branch: head.slice(0, 7) };
        }
        return { worktreeRoot: dir, branch: undefined };
      } catch {
        return { worktreeRoot: dir, branch: undefined };
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return { worktreeRoot: startDir, branch: undefined };
    dir = parent;
  }
};

const buildDevWindowTitle = (): string => {
  const { worktreeRoot, branch } = readGitInfo(process.cwd());
  const worktree = basename(worktreeRoot);
  const kind = process.env.SOMA_TITLE_KIND?.trim() || undefined;
  const name = process.env.SOMA_TITLE_NAME?.trim() || undefined;
  const segments: string[] = [];
  if (branch && branch !== worktree) {
    segments.push(worktree, branch);
  } else {
    segments.push(worktree);
  }
  if (name) {
    segments.push(name);
  }
  const prefix = kind ? `[${kind}] ` : "";
  return `${prefix}${segments.join(" · ")} — LINKS SOMA`;
};

const createWindow = async (): Promise<BrowserWindow | null> => {
  try {
    mainProcessLogger.info("Creating browser window");

    // Create the browser window.
    const mainWindow = new BrowserWindow({
      width: 1200,
      height: 900,
      webPreferences: {
        preload: join(__dirname, "preload.js"),
      },
    });

    if (!app.isPackaged) {
      const devTitle = buildDevWindowTitle();
      mainWindow.on("page-title-updated", (event) => {
        event.preventDefault();
        mainWindow.setTitle(devTitle);
      });
      mainWindow.setTitle(devTitle);
    }

    // ウィンドウ作成エラーのリスナー設定
    mainWindow.webContents.on(
      "did-fail-load",
      (event, errorCode, errorDescription, validatedURL) => {
        mainProcessLogger.error(
          `Failed to load URL: ${validatedURL}`,
          new Error(
            `Error code: ${errorCode}, Description: ${errorDescription}`,
          ),
        );
      },
    );

    mainWindow.webContents.on("render-process-gone", (event, details) => {
      mainProcessLogger.error(
        "Renderer process crashed",
        new Error(`Reason: ${details.reason}, Exit code: ${details.exitCode}`),
      );
      void (async () => {
        await dialog
          .showMessageBox(mainWindow, {
            type: "error",
            title: "エラー",
            message: "アプリケーションがクラッシュしました。再度読み込みます。",
          })
          .then((value) => {
            if (value.response === 0) {
              mainWindow.reload();
            }
          });
      })();
    });

    if (os.platform() === "win32") {
      try {
        createMenu(mainWindow);
        mainProcessLogger.info("Menu created successfully");
      } catch (menuError) {
        mainProcessLogger.error("Failed to create menu", menuError as Error);
        // メニュー作成失敗は致命的ではないので継続
      }
    }

    // Load the app
    try {
      if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
        mainProcessLogger.info(
          `Loading development server: ${MAIN_WINDOW_VITE_DEV_SERVER_URL}`,
        );
        await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
      } else {
        // In production, use Hono server
        const startURL = `http://localhost:${port}`;
        mainProcessLogger.info(`Loading production server: ${startURL}`);
        await mainWindow.loadURL(startURL);
      }

      mainProcessLogger.info("Application loaded successfully");
    } catch (loadError) {
      mainProcessLogger.error(
        "Failed to load application URL",
        loadError as Error,
      );
      await mainProcessLogger.showFatalError(
        "読み込みエラー",
        "アプリケーションの読み込みに失敗しました。",
      );
      return null;
    }

    return mainWindow;
  } catch (windowError) {
    mainProcessLogger.error(
      "Failed to create browser window",
      windowError as Error,
    );
    await mainProcessLogger.showFatalError(
      "ウィンドウ作成エラー",
      "アプリケーションウィンドウの作成に失敗しました。",
    );
    return null;
  }
};

void app.whenReady().then(async () => {
  try {
    mainProcessLogger.info("Application is ready, starting initialization");

    // データベースマイグレーション
    try {
      const migrationsFolder = isDev
        ? "drizzle"
        : join(process.resourcesPath, "drizzle");

      mainProcessLogger.info(
        `Starting database migration from: ${migrationsFolder}`,
      );
      migrate(db, { migrationsFolder });
      mainProcessLogger.info("Database migration completed successfully");
    } catch (migrationError) {
      mainProcessLogger.error(
        "Database migration failed",
        migrationError as Error,
      );
      await mainProcessLogger.showFatalError(
        "データベースエラー",
        "データベースの初期化に失敗しました。アプリケーションを再インストールしてください。",
      );
      app.quit();
      return;
    }

    // プリセットモデルの処理
    try {
      const firstLaunch = await isFirstLaunch();

      if (firstLaunch) {
        mainProcessLogger.info(
          "First launch detected, starting preset models process",
        );
        await presetModels();
        mainProcessLogger.info("Preset models process completed");
      } else {
        mainProcessLogger.info(
          "Subsequent launch, skipping preset models process",
        );
      }
    } catch (presetError) {
      mainProcessLogger.error(
        "Preset models process failed",
        presetError as Error,
      );
      // プリセット失敗は致命的ではないので継続
    }

    let mainWindow: BrowserWindow | null = null;

    if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      // Set up Hono server for production
      try {
        const distPath = join(
          __dirname,
          `../renderer/${MAIN_WINDOW_VITE_NAME}`,
        );
        mainProcessLogger.info(
          `Setting up Hono server with dist path: ${distPath}`,
        );

        // Serve static files
        hono.use("/*", serveStatic({ root: distPath }));

        // SPAのためのフォールバック設定を追加
        hono.get("*", (c) => {
          try {
            const html = readFileSync(join(distPath, "index.html"), "utf-8");
            return c.html(html);
          } catch (readError) {
            mainProcessLogger.error(
              "Failed to read index.html",
              readError as Error,
            );
            return c.text("Internal Server Error", 500);
          }
        });

        // Start the server
        mainProcessLogger.info(`Starting Hono server on port ${port}`);
        serve(
          {
            fetch: hono.fetch,
            port,
          },
          () => {
            mainProcessLogger.info("Hono server started successfully");
            void (async (): Promise<void> => {
              mainWindow = await createWindow();
              if (!mainWindow) {
                mainProcessLogger.error(
                  "Failed to create window after server start",
                );
                app.quit();
              }
            })();
          },
        );
      } catch (serverError) {
        mainProcessLogger.error(
          "Failed to start Hono server",
          serverError as Error,
        );
        await mainProcessLogger.showFatalError(
          "サーバー起動エラー",
          "内部サーバーの起動に失敗しました。",
        );
        app.quit();
        return;
      }
    } else {
      mainWindow = await createWindow();
      if (!mainWindow) {
        mainProcessLogger.error("Failed to create window in development mode");
        app.quit();
        return;
      }
    }

    // Register IPC main listeners
    try {
      mainProcessLogger.info(
        "Registering IPC main listeners with error handling",
      );
      Object.entries(ipcMainListeners).forEach(([channel, listener]) => {
        // 各IPCリスナーにエラーハンドリングを適用
        const wrappedListener = withIpcErrorHandling(channel, listener);
        ipcMain.handle(channel, wrappedListener);
      });
      mainProcessLogger.info(
        `Registered ${Object.keys(ipcMainListeners).length} IPC listeners with error handling`,
      );
    } catch (ipcError) {
      mainProcessLogger.error(
        "Failed to register IPC listeners",
        ipcError as Error,
      );
      // IPC登録失敗は致命的なのでアプリを終了
      await mainProcessLogger.showFatalError(
        "IPC登録エラー",
        "内部通信システムの初期化に失敗しました。",
      );
      app.quit();
      return;
    }

    // React DevTool Path
    try {
      const reactDevToolExtensionPath = getReactDevToolsPath();

      // if React DevTool is not installed
      if (reactDevToolExtensionPath && isDev) {
        mainProcessLogger.info(
          `Loading React DevTools from: ${reactDevToolExtensionPath}`,
        );
        await session.defaultSession.loadExtension(reactDevToolExtensionPath);
        mainProcessLogger.info("React DevTools loaded successfully");
      }
    } catch (devToolsError) {
      mainProcessLogger.warn(
        "Failed to load React DevTools",
        devToolsError as Error,
      );
      // DevTools読み込み失敗は致命的ではないので継続
    }

    app.on("activate", () => {
      // On OS X it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        mainProcessLogger.info("Recreating window on activate");
        void (async (): Promise<void> => {
          try {
            const newWindow = await createWindow();
            if (!newWindow) {
              mainProcessLogger.error("Failed to recreate window on activate");
            }
          } catch (activateError) {
            mainProcessLogger.error(
              "Error during app activation",
              activateError as Error,
            );
          }
        })();
      }
    });

    mainProcessLogger.info("Application initialization completed successfully");
  } catch (initError) {
    mainProcessLogger.error(
      "Application initialization failed",
      initError as Error,
    );
    await mainProcessLogger.showFatalError(
      "初期化エラー",
      "アプリケーションの初期化に失敗しました。",
    );
    app.quit();
  }
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
  try {
    const devtoolsId = "fmkadmapgofadopljbjfkapdkoienihi";
    const platform = os.platform();

    switch (platform) {
      case "win32": {
        const winDevToolsInstallPath = `${process.env.LOCALAPPDATA}\\Google\\Chrome\\User Data\\Default\\Extensions\\${devtoolsId}\\`;
        if (!existsSync(winDevToolsInstallPath)) {
          return null;
        }
        const dirs = readdirSync(winDevToolsInstallPath);
        return dirs.length > 0 ? join(winDevToolsInstallPath, dirs[0]) : null;
      }
      case "darwin": {
        const macDevToolsInstallPath = `${os.homedir()}/Library/Application Support/Google/Chrome/Default/Extensions/${devtoolsId}/`;
        if (!existsSync(macDevToolsInstallPath)) {
          return null;
        }
        const macDirs = readdirSync(macDevToolsInstallPath);
        return macDirs.length > 0
          ? join(macDevToolsInstallPath, macDirs[0])
          : null;
      }
      case "linux": {
        const linuxDevToolsInstallPath = `${os.homedir()}/.config/google-chrome/Default/Extensions/${devtoolsId}/`;
        if (!existsSync(linuxDevToolsInstallPath)) {
          return null;
        }
        const linuxDirs = readdirSync(linuxDevToolsInstallPath);
        return linuxDirs.length > 0
          ? join(linuxDevToolsInstallPath, linuxDirs[0])
          : null;
      }
      default:
        return null;
    }
  } catch (error) {
    mainProcessLogger.warn("Failed to get React DevTools path", error as Error);
    return null;
  }
};
