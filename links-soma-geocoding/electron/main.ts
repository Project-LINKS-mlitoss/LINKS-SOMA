// electron/main.ts
import { app, BrowserWindow } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {},
  });

  // React アプリのビルド成果物を読み込む場合
  const indexHtmlPath = path.join(__dirname, '..', '..', 'dist', 'index.html');
  mainWindow.loadFile(indexHtmlPath);

  // 開発時に React Dev Server を使う場合
  // mainWindow.loadURL('http://localhost:3000');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  // macOS 以外ではすべてのウィンドウが閉じられた時に終了
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // macOS ではウィンドウが全て閉じられても、Dock アイコンがクリックされたら再度ウィンドウを開く
  if (mainWindow === null) {
    createWindow();
  }
});
