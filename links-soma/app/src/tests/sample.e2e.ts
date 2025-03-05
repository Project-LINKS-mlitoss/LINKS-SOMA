import {
  test,
  _electron as electron,
  expect,
  type ElectronApplication,
} from "@playwright/test";
import {
  findLatestBuild,
  parseElectronApp,
  clickMenuItemById,
} from "electron-playwright-helpers";

let electronApp: ElectronApplication;

test.beforeAll(async () => {
  // find the latest build in the out directory
  const latestBuild = findLatestBuild();
  // parse the packaged Electron app and find paths and other info
  const appInfo = parseElectronApp(latestBuild);
  electronApp = await electron.launch({
    executablePath: appInfo.executable, // path to the Electron executable
  });
});

test.afterAll(async () => {
  await electronApp.close();
});

test("launch app", async () => {
  const page = await electronApp.firstWindow();
  const title = await page.title();
  expect(title).toBe("LINKS SOMA　空き家推定システム");
  expect(page).not.toBeNull();
});
