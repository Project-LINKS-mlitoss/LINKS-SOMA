import { describe, expect, it } from "vitest";
import { toOdsDisplayName } from "./optional-data-source";

/**
 * 画面に内部カラム名をそのまま出さないための変換。
 * 建物関連データ由来（`_ods`）は「[追加] カラム名」、それ以外は日本語名にする。
 */
describe("toOdsDisplayName", () => {
  it("_ods サフィックスを [追加] プレフィックスに置き換える", () => {
    expect(toOdsDisplayName("課税標準額_ods")).toBe("[追加] 課税標準額");
  });

  it("標準カラムは日本語名に変換する", () => {
    expect(toOdsDisplayName("household_size")).toBe("世帯人数");
  });

  it("ML側の内部名はDB名に読み替えてから日本語化する", () => {
    expect(toOdsDisplayName("household_size_juki_residence")).toBe("世帯人数");
  });

  it("未登録のカラム名はそのまま返す", () => {
    expect(toOdsDisplayName("unknown_column")).toBe("unknown_column");
  });
});
