import { describe, expect, it } from "vitest";
import { generateAllColumnsData } from "./popup-utils";

type Column = { key: string; label: string; value: string | null };

const pick = (
  properties: Record<string, unknown>,
  key: string,
): Column | undefined =>
  generateAllColumnsData(properties, "building").find(
    (column) => column.key === key,
  );

/** ポップアップの空き家調査結果ラベル（実測）表示 */
describe("generateAllColumnsData の is_vacant 表示", () => {
  it("1 を「空き家」と表示する", () => {
    expect(pick({ is_vacant: 1 }, "is_vacant")).toEqual({
      key: "is_vacant",
      label: "空き家",
      value: "空き家",
    });
  });

  it("0 を「非空き家」と表示する", () => {
    expect(pick({ is_vacant: 0 }, "is_vacant")?.value).toBe("非空き家");
  });

  it("値がないときは null を返す", () => {
    expect(pick({ is_vacant: null }, "is_vacant")?.value).toBeNull();
  });
});

/**
 * 空き家調査結果に付随する4列。issue #1794 で「推定結果にも出力する」と決めたため、
 * 除外リストに載せず日本語ラベル付きで表示されることを固定する。
 */
describe("generateAllColumnsData の空き家調査結果メタ列表示", () => {
  it("vacant_type を「空き家区分」として表示する", () => {
    expect(pick({ vacant_type: "特定空家" }, "vacant_type")).toEqual({
      key: "vacant_type",
      label: "空き家区分",
      value: "特定空家",
    });
  });

  it("vacant_source を「空き家調査元」として表示する", () => {
    expect(pick({ vacant_source: "空き家台帳" }, "vacant_source")?.label).toBe(
      "空き家調査元",
    );
  });

  it("vacant_year を「空き家調査年度」として表示する", () => {
    expect(pick({ vacant_year: "令和5年" }, "vacant_year")).toEqual({
      key: "vacant_year",
      label: "空き家調査年度",
      value: "令和5年",
    });
  });

  it("address_precision_flag の 1 を「該当」と表示する", () => {
    expect(
      pick({ address_precision_flag: 1 }, "address_precision_flag"),
    ).toEqual({
      key: "address_precision_flag",
      label: "調査住所精度不足フラグ",
      value: "該当",
    });
  });

  it("address_precision_flag の 0 を「非該当」と表示する", () => {
    expect(
      pick({ address_precision_flag: 0 }, "address_precision_flag")?.value,
    ).toBe("非該当");
  });

  it("マッチしていない行の空文字は値なしとして扱う", () => {
    expect(pick({ vacant_type: "" }, "vacant_type")?.value).toBe("");
  });
});
