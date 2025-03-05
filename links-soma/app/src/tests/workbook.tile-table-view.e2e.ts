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

test('表形式のタイルで正しくカラム選択ができること', async () => {
    test.setTimeout(120000);
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

    await testWorkbook.click()


    let dataSetButton = await page.getByText(/分析結果\(3.2万件\)-[0-9]/i)

    if (dataSetButton === null) {
        const oneOfTenthDataInputButton = await page.getByRole("button", { name: "3.2万件のデータセットを追加" })

        await oneOfTenthDataInputButton.click()

        await page.waitForTimeout(30000)

        await page.reload()

        dataSetButton = await page.getByText(/分析結果\(3.2万件\)-[0-9]/i)
    }

    expect(dataSetButton).not.toBeNull()

    await dataSetButton.click()

    const styleSelect = await page.getByLabel("スタイル")
    await styleSelect.selectOption("表")

    const columns = ["性比", "居住期間"]
    for (const column of columns) {
        const columnSelect = await page.getByRole("combobox", { name: "カラム" })
        await columnSelect.click()
        const optionColumn = await page.getByText(column)
        await optionColumn.click()
    }

    const tileTable = await page.getByRole("table")
    const genderRatioHeader = await tileTable.getByText("性比")
    const residencePeriodHeader = await tileTable.getByText("居住期間")

    expect(genderRatioHeader).not.toBeNull()
    expect(residencePeriodHeader).not.toBeNull()
})