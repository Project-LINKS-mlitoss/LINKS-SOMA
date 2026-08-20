import { describe, expect } from "vitest";
import { lang } from "../../../shared/config/lang";
import { DETECTORS } from "./detectors";
import { REFERENCE_ASPECT_KEY } from "./cross-file";
import { ENCODING_ASPECT_KEY } from "./encoding";
import { DATE_ORDER_ASPECT_KEY } from "./date-order";
import { PV_CODE } from "./pv-codes";

describe("PV_CODE（観点コードの採番・ADR-0027）", (it) => {
  it("実装済み検出器すべてに PV-NN 形式のコードが採番されている", () => {
    for (const aspect of Object.keys(DETECTORS)) {
      expect(PV_CODE[aspect as keyof typeof PV_CODE]).toMatch(/^PV-\d{2}$/);
    }
  });

  it("観点マスタと一致する（一意性=PV-07 / 数値形式=PV-04）", () => {
    expect(PV_CODE.uniqueness).toBe("PV-07");
    expect(PV_CODE.data_type_numeric).toBe("PV-04");
  });
});

describe("観点ラベルの網羅（型の代わりにテストで保証）", (it) => {
  // ラベルは lang.ts に移したため Record<AspectId> の型強制が効かない。
  // 全観点キー（検出器＋参照整合）に表示名があることをテストで担保する。
  const labels = lang.components.normalizationPreValidation.labels as Record<
    string,
    string
  >;

  it("全検出器の観点キーに lang.ts のラベルがある", () => {
    for (const aspect of Object.keys(DETECTORS)) {
      expect(labels[aspect]).toBeTruthy();
    }
  });

  // 別経路（検出器に無い）の観点キーも画面ラベルを持つことを保証する。
  // 具体的なラベル文字列は表示コピーなので lang.ts を正本とし、ここでは存在のみ検証。
  it("参照整合（クロスファイル）の観点キーにもラベルがある", () => {
    expect(labels[REFERENCE_ASPECT_KEY]).toBeTruthy();
  });

  it("文字コード（ファイル単位）の観点キーにもラベルがある", () => {
    expect(labels[ENCODING_ASPECT_KEY]).toBeTruthy();
  });

  it("前後関係（2カラム同一行）の観点キーにもラベルがある", () => {
    expect(labels[DATE_ORDER_ASPECT_KEY]).toBeTruthy();
  });
});
