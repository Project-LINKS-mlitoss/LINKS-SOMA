import { describe, expect, it } from "vitest";
import { toOdsColumnNames } from "./ods-columns";

describe("toOdsColumnNames", () => {
  it("`_ods` で終わる列だけを表示名へ変換する。名寄せ結果には全特徴量の列が並ぶため", () => {
    expect(
      toOdsColumnNames([
        "normalized_address",
        "課税標準額_ods",
        "has_juki_registry",
        "建築年_ods",
      ]),
    ).toEqual(["[追加] 課税標準額", "[追加] 建築年"]);
  });

  it("追加カラムが無ければ空配列。建物関連データを使っていないジョブの結果", () => {
    expect(
      toOdsColumnNames(["normalized_address", "has_juki_registry"]),
    ).toEqual([]);
  });

  it("ヘッダが読めなければ空配列。結果ファイルが削除されている場合に行ごと落とす", () => {
    expect(toOdsColumnNames(undefined)).toEqual([]);
  });
});
