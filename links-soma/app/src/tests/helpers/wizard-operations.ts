/**
 * 名寄せウィザードE2Eテスト用の共通ヘルパー
 *
 * データセット選択、カラムマッピング、ファイルアップロードなどの
 * ウィザード操作を共通化する
 */

import * as path from "path";
import { expect, type Page } from "@playwright/test";
import { type NormalizationPurpose } from "../../features/normalization/hooks/use-form-normalization";

// サンプルデータの表示名マッピング
export const SAMPLE_DATA_FILES = {
  water_status: "水道開閉栓状況",
  water_usage: "水道使用量",
  resident_registry: "住民基本台帳",
  geocoding: "ジオコーディング済データ",
  building_registry: "登記",
  building_polygon: "建物ポリゴンデータ",
  building_type_determination: "推定対象選定用データ",
  vacant_house: "空き家調査結果",
  optional_data_source: "住民基本台帳", // 住民基本台帳を流用
} as const;

// サンプルデータの実際のファイル名マッピング（アップロード用）
const SAMPLE_DATA_FILE_NAMES: Record<string, string> = {
  水道開閉栓状況: "水道開閉栓状況.csv",
  水道使用量: "水道使用量.csv",
  住民基本台帳: "住民基本台帳.csv",
  ジオコーディング済データ: "ジオコーディング済データ.csv",
  登記: "登記.csv",
  建物ポリゴンデータ: "建物ポリゴンデータ（PLATEAU）.gpkg",
  推定対象選定用データ: "推定対象選定用データ.csv",
  空き家調査結果: "空き家調査結果.csv",
  // 説明変数追加用(ODS)の型不一致(E-201)再現用: 世帯コードを非数値「不明」にした版
  説明変数追加用_型不正: "説明変数追加用_型不正.csv",
};

// カラムマッピング設定（フィールドラベルとサンプルデータのカラム名を対応付け）
// ラベルは「{shortLabel}カラム」形式（例: "住所カラム", "水道番号カラム"）
type ColumnMapping = Record<string, string>;
const COLUMN_MAPPINGS: Record<string, ColumnMapping> = {
  water_status: {
    水道番号カラム: "水道番号",
    水道閉栓年月カラム: "使用中止日",
    水道開栓年月カラム: "使用開始日",
    住所カラム: "住所",
  },
  water_usage: {
    水道番号カラム: "水道番号",
    水道使用量カラム: "使用水量",
    水道検針年月日カラム: "検針年月日",
  },
  resident_registry: {
    世帯番号カラム: "世帯コード",
    住所カラム: "住所",
    生年月日カラム: "生年月日",
    住定年月日カラム: "住定日",
    異動事由カラム: "異動事由",
    異動日カラム: "異動日",
  },
  geocoding: {
    住所カラム: "住所",
    緯度カラム: "緯度",
    経度カラム: "経度",
  },
  building_registry: {
    住所カラム: "住所",
    構造名カラム: "構造名称",
    登記理由カラム: "登記理由",
    登記日付カラム: "登記日付",
  },
  building_type_determination: {
    住所カラム: "住所",
    家屋種別カラム: "種別",
  },
  // GeoPackage/Shapefile 形式では住所カラムが選択不可になるため家屋種別のみ割り当てる
  building_type_determination_geopackage: {
    家屋種別カラム: "usage",
  },
  vacant_house: {
    住所カラム: "空き家住所",
  },
  optional_data_source: {
    住所カラム: "住所",
  },
};

// schemaKeyとdisplayNameの対応
const SCHEMA_KEY_MAP: Record<string, string> = {
  水道開閉栓状況: "water_status",
  水道使用量: "water_usage",
  住民基本台帳: "resident_registry",
  ジオコーディング済データ: "geocoding",
  登記: "building_registry",
  推定対象選定用データ: "building_type_determination",
  空き家調査結果: "vacant_house",
};

// フィクスチャディレクトリのパス
const FIXTURES_DIR = path.join(__dirname, "../fixtures");

/**
 * ウィザードのオプショナルステップの操作指定
 * - "skip": スキップチェックボックスをONにして次へ
 * - "select": SAMPLE_DATA_FILESから選択してカラム設定
 * - { name: string }: 指定した名前でデータセットを選択（建物ポリゴン等）
 * - { searchPattern: RegExp }: ダイアログ内をパターン検索して選択
 */
export type StepAction =
  | "skip"
  | "select"
  | { name: string }
  | { searchPattern: RegExp };

export type WalkWizardOptions = {
  /** 名寄せの目的（デフォルト: "vacancy_estimation"＝空き家推定） */
  purpose?: NormalizationPurpose;
  /** 基準日（デフォルト: "2024-01-01"） */
  referenceDate?: string;
  /** 名寄せ処理対象市区町村名（デフォルト: "テスト市"） */
  municipality?: string;
  /** Step 6: ジオコーディング（デフォルト: "select"） */
  geocoding?: StepAction;
  /** Step 7: 建物登記データ（デフォルト: "select"） */
  buildingRegistry?: StepAction;
  /** Step 8: 建物ポリゴン（デフォルト: "skip"） */
  buildingPolygon?: StepAction;
  /** Step 9: 推定対象選定用データ（デフォルト: "select"） */
  buildingTypeDetermination?: StepAction;
  /**
   * Step 9: 推定対象選定用データの「家屋種別」で住宅とみなす値（デフォルト: []）
   * buildingTypeDetermination が "select" の場合のみ適用される
   */
  residentialValues?: string[];
  /**
   * Step 9: 推定対象選定用データのファイル形式（デフォルト: "csv"）
   * "geopackage" / "shapefile" は IF001 の建物ポリゴン経路（点を建物の重心
   * バッファに重ねる空間結合）を通す。CSV は住所結合経路を通る。
   */
  buildingTypeDeterminationFileType?: "csv" | "geopackage" | "shapefile";
  /**
   * Step 9: 推定対象選定用データのアップロード元（表示名）。
   * SAMPLE_DATA_FILE_NAMES に登録済みの表示名を渡す。
   */
  buildingTypeDeterminationFile?: string;
  /** Step 10: 空き家調査結果（デフォルト: "skip"） */
  vacantHouse?: StepAction;
  /** Step 11: 建物関連データ（デフォルト: "skip"） */
  optionalDataSource?: StepAction;
  /**
   * Step 11: 建物関連データのアップロード元（表示名）。デフォルトは
   * SAMPLE_DATA_FILES.optional_data_source（住民基本台帳）。型不一致(E-201)の
   * 再現等で別フィクスチャを ODS に流す場合に指定する。SAMPLE_DATA_FILE_NAMES に
   * 登録済みの表示名を渡す。
   */
  optionalDataSourceFile?: string;
};

/**
 * 名寄せ画面に遷移してウィザードを起動する
 *
 * 名寄せ画面への遷移 → 「名寄せ処理を始める」クリック → 下書きダイアログ処理 → イントロ画面到達
 *
 * walkWizard() の前に呼ぶことで、ウィザード起動の定型コードを共通化する。
 */
export async function startNormalizationWizard(page: Page): Promise<void> {
  // 名寄せ画面に遷移
  await page.locator('a[href="#normalization"]').click();
  await page.waitForFunction(
    () => window.location.hash.includes("normalization"),
    { timeout: 10000 },
  );
  await page.waitForTimeout(1000);

  // 「名寄せ処理を始める」をクリック
  await page.getByRole("button", { name: /名寄せ処理を始める/i }).click();

  // 下書きが存在する場合は「新規作成」を選択
  const draftDialog = page.getByRole("heading", { name: "下書きがあります" });
  if (await draftDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.getByRole("button", { name: "新規作成" }).click();
  }

  // イントロ画面の表示を確認
  await expect(page.getByText("用意するデータ", { exact: true })).toBeVisible();
}

/**
 * 名寄せウィザードをイントロ画面から確認画面まで走査する
 *
 * 前提: ウィザードのイントロ画面（「用意するデータ」）が表示されていること
 */
export async function walkWizard(
  page: Page,
  options: WalkWizardOptions = {},
): Promise<void> {
  const {
    purpose = "vacancy_estimation",
    referenceDate = "2024-01-01",
    municipality = "テスト市",
    geocoding = "select",
    buildingRegistry = "select",
    buildingPolygon = "skip",
    buildingTypeDetermination = "select",
    residentialValues = [],
    buildingTypeDeterminationFileType = "csv",
    buildingTypeDeterminationFile = SAMPLE_DATA_FILES.building_type_determination,
    vacantHouse = "skip",
    optionalDataSource = "skip",
    optionalDataSourceFile = SAMPLE_DATA_FILES.optional_data_source,
  } = options;
  const isModelTraining = purpose === "model_training";

  // Step 0: イントロ（目的選択）→ 次へ。AIモデル構築は当該カードをクリック。
  if (isModelTraining) {
    await page.getByText("AIモデル構築用の名寄せ処理", { exact: true }).click();
  }
  await clickNext(page);

  // 基本設定（基準日 + 市区町村名）
  await page.locator('input[type="date"]').fill(referenceDate);
  await page.getByPlaceholder("市区町村名を入力").fill(municipality);
  await clickNext(page);

  // 必須: 水道閉開栓状況
  await selectDatasetByName(page, SAMPLE_DATA_FILES.water_status);
  await selectColumns(page, SAMPLE_DATA_FILES.water_status);
  await clickNext(page);

  // 必須: 水道使用量
  await selectDatasetByName(page, SAMPLE_DATA_FILES.water_usage);
  await selectColumns(page, SAMPLE_DATA_FILES.water_usage);
  await clickNext(page);

  // 必須: 住民基本台帳
  await selectDatasetByName(page, SAMPLE_DATA_FILES.resident_registry);
  await selectColumns(page, SAMPLE_DATA_FILES.resident_registry);
  await clickNext(page);

  // AIモデル構築用は空き家調査結果が必須で、必須ブロック末尾（住民基本台帳の直後）に来る。
  if (isModelTraining) {
    await selectDatasetByName(page, SAMPLE_DATA_FILES.vacant_house);
    await selectColumns(page, "vacant_house");
    await clickNext(page);
  }

  // 任意: ジオコーディング
  await handleOptionalStep(page, geocoding, {
    dataFile: SAMPLE_DATA_FILES.geocoding,
    schemaKey: SAMPLE_DATA_FILES.geocoding,
  });

  // 任意: 建物登記データ
  await handleOptionalStep(page, buildingRegistry, {
    dataFile: SAMPLE_DATA_FILES.building_registry,
    schemaKey: SAMPLE_DATA_FILES.building_registry,
  });

  // 任意: 建物ポリゴン（カラム選択なし）
  await handleOptionalStep(page, buildingPolygon, {
    dataFile: SAMPLE_DATA_FILES.building_polygon,
    skipColumns: true,
  });

  // 任意: 処理対象選定用データ
  await handleOptionalStep(page, buildingTypeDetermination, {
    dataFile: buildingTypeDeterminationFile,
    schemaKey:
      buildingTypeDeterminationFileType === "csv"
        ? "building_type_determination"
        : "building_type_determination_geopackage",
    residentialValues,
    inputFileType: buildingTypeDeterminationFileType,
  });

  // 空き家推定用は空き家調査結果が任意で、任意ブロックに来る。
  if (!isModelTraining) {
    await handleOptionalStep(page, vacantHouse, {
      dataFile: SAMPLE_DATA_FILES.vacant_house,
      schemaKey: "vacant_house",
    });
  }

  // 任意: 建物関連データ
  await handleOptionalStep(page, optionalDataSource, {
    dataFile: optionalDataSourceFile,
    schemaKey: "optional_data_source",
  });
}

/**
 * オプショナルステップを操作する内部ヘルパー
 */
async function handleOptionalStep(
  page: Page,
  action: StepAction,
  config: {
    dataFile: string;
    schemaKey?: string;
    skipColumns?: boolean;
    residentialValues?: string[];
    inputFileType?: "csv" | "geopackage" | "shapefile";
  },
): Promise<void> {
  if (action === "skip") {
    const skipCheckbox = page.getByLabel("このステップをスキップする");
    if (await skipCheckbox.isVisible()) {
      await skipCheckbox.check();
    }
    await clickNext(page);
  } else if (action === "select") {
    // ファイル形式はデータセット選択より先に決める。住所カラムの活性状態が
    // これに従属するため
    if (config.inputFileType && config.inputFileType !== "csv") {
      await page.getByLabel("ファイル形式").selectOption(config.inputFileType);
      await page.waitForTimeout(300);
    }
    await selectDatasetByName(page, config.dataFile);
    if (!config.skipColumns && config.schemaKey) {
      await selectColumns(page, config.schemaKey);
    }
    if (config.residentialValues && config.residentialValues.length > 0) {
      await setResidentialValues(page, config.residentialValues);
    }
    await clickNext(page);
  } else if ("name" in action) {
    await selectDatasetByName(page, action.name);
    await clickNext(page);
  } else if ("searchPattern" in action) {
    // スキップチェックボックスがONの場合はOFFにする
    const skipCheckbox = page.getByLabel("このステップをスキップする");
    if (await skipCheckbox.isChecked().catch(() => false)) {
      await skipCheckbox.uncheck();
    }
    await page.waitForTimeout(500);

    await page.getByText("データセットを選択").click();
    await page.waitForSelector('[role="dialog"]');

    const dialogRows = page.locator('[role="dialog"] table tbody tr');
    const matchedRow = dialogRows.filter({ hasText: action.searchPattern });

    if ((await matchedRow.count()) === 0) {
      await page.keyboard.press("Escape");
      throw new Error(`データセットが見つかりません: ${action.searchPattern}`);
    }
    await matchedRow.first().click();
    await page.getByRole("button", { name: "選択" }).last().click();
    await page.waitForSelector('[role="dialog"]', { state: "hidden" });
    await page.waitForTimeout(500);
    await clickNext(page);
  }
}

/**
 * 推定対象選定用データstep内で「家屋種別」住宅判定値を選択する
 *
 * 前提: building_type カラム選択後、buildingTypeValues の fetch が完了していること
 * （fetch完了 = 「変更」ボタンが enabled になる、を待機シグナルとする）
 */
async function setResidentialValues(
  page: Page,
  values: string[],
): Promise<void> {
  // 家屋種別Field内の「変更」ボタン。当ステップでは唯一存在
  const triggerButton = page.getByRole("button", { name: "変更" });

  // 値の fetch 完了 = ボタンが enabled になるまで待機
  await expect(triggerButton).toBeEnabled({ timeout: 30000 });
  await triggerButton.click();
  await page.waitForSelector('[role="dialog"]');
  // ダイアログopen時のuseEffect（searchTextリセット）を待機
  await page.waitForTimeout(500);

  const dialog = page.locator('[role="dialog"]').last();

  for (const value of values) {
    const search = dialog.locator('input[placeholder="検索..."]');
    await search.fill(value);
    // useDeferredValue による遅延更新を待機
    await page.waitForTimeout(700);

    // 仮想スクロールリスト内の可視ラベルテキストノードをクリック
    // ラベルクリックで for/id 関連付けされた checkbox がトグルされる
    const labelText = dialog.getByText(value, { exact: true });
    await labelText.first().waitFor({ state: "visible", timeout: 10000 });
    await labelText.first().click();
  }

  await page.getByRole("button", { name: "保存" }).click();
  await page.waitForSelector('[role="dialog"]', { state: "hidden" });
}

/**
 * 「次へ」ボタンをクリックして待機
 */
export async function clickNext(page: Page): Promise<void> {
  await page.getByRole("button", { name: "次へ" }).click();
  await page.waitForTimeout(500);
}

/**
 * ファイル名でデータセットを選択（存在しない場合はアップロード）
 */
export async function selectDatasetByName(
  page: Page,
  displayName: string,
): Promise<void> {
  await page.getByText("データセットを選択").click();
  await page.waitForSelector('[role="dialog"]');

  const targetRow = page.locator(`[role="dialog"] table tbody tr`, {
    hasText: displayName,
  });

  if ((await targetRow.count()) > 0) {
    await targetRow.first().click();
    await page.getByRole("button", { name: "選択" }).last().click();
  } else {
    await uploadDataset(page, displayName);
  }

  await page.waitForSelector('[role="dialog"]', { state: "hidden" });
}

/**
 * 新規アップロードタブでデータセットをアップロード
 */
async function uploadDataset(page: Page, displayName: string): Promise<void> {
  await page.getByRole("tab", { name: "新規アップロード" }).click();
  await page.waitForTimeout(300);

  const actualFileName = SAMPLE_DATA_FILE_NAMES[displayName];
  if (!actualFileName) {
    throw new Error(`フィクスチャが見つかりません: ${displayName}`);
  }

  const filePath = path.join(FIXTURES_DIR, actualFileName);
  const fileInput = page.locator('[role="dialog"] input[type="file"]');
  await fileInput.setInputFiles(filePath);
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: "選択" }).last().click();
  await page.waitForTimeout(1000);
}

/**
 * データセットのカラムを選択する
 * @param page - Playwrightのページ
 * @param displayNameOrSchemaKey - 表示名またはschemaKey
 */
export async function selectColumns(
  page: Page,
  displayNameOrSchemaKey: string,
  mappingOverride?: Record<string, string>,
): Promise<void> {
  const schemaKey =
    SCHEMA_KEY_MAP[displayNameOrSchemaKey] ?? displayNameOrSchemaKey;

  const baseMapping = COLUMN_MAPPINGS[schemaKey];
  if (!baseMapping) return;
  // mappingOverride で一部フィールドの割当を差し替える（例: 同一入力列を2項目へ
  // 割り当てる E-102 の再現）。キー順は base のまま保たれる。
  const columnMapping = mappingOverride
    ? { ...baseMapping, ...mappingOverride }
    : baseMapping;

  await page.waitForTimeout(1000);

  for (const [fieldLabel, columnValue] of Object.entries(columnMapping)) {
    try {
      const dropdown = page.getByLabel(fieldLabel, { exact: true });
      if ((await dropdown.count()) === 0) {
        // eslint-disable-next-line no-console -- E2Eテストのデバッグ
        console.log(`Label not found: ${fieldLabel}`);
        continue;
      }

      await dropdown.click();
      await page.waitForTimeout(300);

      const option = page.getByRole("option", {
        name: columnValue,
        exact: true,
      });
      if ((await option.count()) > 0) {
        await option.click();
        await page.waitForTimeout(200);
      } else {
        const partialOption = page
          .getByRole("option")
          .filter({ hasText: columnValue });
        if ((await partialOption.count()) > 0) {
          await partialOption.first().click();
          await page.waitForTimeout(200);
        } else {
          // eslint-disable-next-line no-console -- E2Eテストのデバッグ
          console.log(`Option not found: ${columnValue} for ${fieldLabel}`);
          await page.keyboard.press("Escape");
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console -- E2Eテストのデバッグ
      console.log(`Error selecting column ${fieldLabel}:`, error);
      try {
        await page.keyboard.press("Escape");
      } catch {
        // ignore
      }
    }
  }
}
