import test, { type ElectronApplication, _electron as electron, expect } from "@playwright/test";
import { findLatestBuild, parseElectronApp } from "electron-playwright-helpers";

let electronApp: ElectronApplication

test.beforeAll(async () => {
    // find the latest build in the out directory
    const latestBuild = findLatestBuild()
    // parse the packaged Electron app and find paths and other info
    const appInfo = parseElectronApp(latestBuild)
    electronApp = await electron.launch({
        executablePath: appInfo.executable // path to the Electron executable
    })
})

test.afterAll(async () => {
    await electronApp.close()
})

test('分析ページへ移動し、ワークブックを作成', async () => {
    const page = await electronApp.firstWindow()

    const createWorkbookButton = await page.getByRole("button", { name: "新規ワークブック作成" })

    expect(createWorkbookButton).not.toBeNull()

    await createWorkbookButton.click()

    const workbookTitleInput = await page.getByRole("textbox");

    expect(workbookTitleInput).not.toBeNull()

    await workbookTitleInput.fill("テストワークブック")

    const saveButton = await page.getByText("保存")
    await saveButton.click()

    const testWorkbook = await page.getByText("テストワークブック")

    expect(testWorkbook).not.toBeNull()
})