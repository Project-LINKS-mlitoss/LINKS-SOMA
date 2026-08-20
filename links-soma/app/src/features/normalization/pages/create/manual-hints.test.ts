import { describe, expect, it } from "vitest";
import { getManualHint, MANUAL_HINTS } from "./manual-hints";
import { getDatasetSteps } from "./wizard-steps";

/** ウィザードに実在するデータセットステップの schemaKey 列 */
const datasetKeys = getDatasetSteps().map((step) => step.schemaKey);

describe("期待するアップロード形式（formats）", () => {
  it("すべてのデータセットステップに形式が定義されている", () => {
    for (const key of datasetKeys) {
      const hint = getManualHint(key);
      expect(hint, `${key} のマニュアルヒントが無い`).toBeDefined();
      expect(hint?.formats.length, `${key} の形式が未定義`).toBeGreaterThan(0);
    }
  });

  it("形式は空文字を含まない", () => {
    for (const hint of Object.values(MANUAL_HINTS)) {
      for (const format of hint.formats) {
        expect(format.trim()).not.toBe("");
      }
    }
  });

  it("ポリゴン系は ZIP と gpkg を提示する（マニュアル 3.2.7 / 3.2.9）", () => {
    expect(getManualHint("building_polygon")?.formats).toEqual([
      "ZIP（Shapefile）",
      "gpkg（ジオパッケージ）",
    ]);
    expect(getManualHint("building_type_determination")?.formats).toEqual([
      "ZIP（Shapefile）",
      "gpkg（ジオパッケージ）",
      "CSV",
    ]);
  });

  it("ポリゴン系以外は CSV のみ", () => {
    const polygonKeys = ["building_polygon", "building_type_determination"];
    const csvOnlyKeys = datasetKeys.filter(
      (key) => key !== null && !polygonKeys.includes(key),
    );

    expect(csvOnlyKeys.length).toBeGreaterThan(0);
    for (const key of csvOnlyKeys) {
      expect(getManualHint(key)?.formats, `${key} は CSV のみのはず`).toEqual([
        "CSV",
      ]);
    }
  });
});

describe("MANUAL_HINTS のキー", () => {
  it("ウィザードのデータセットステップと過不足なく一致する", () => {
    expect(Object.keys(MANUAL_HINTS).sort()).toEqual([...datasetKeys].sort());
  });
});
