import { describe, expect, it } from "vitest";
import { collectOdsColumns } from "./collect-ods-columns";

describe("collectOdsColumns", () => {
  it("_odsサフィックスのカラムをOptionalDataSourceEntry[]に変換する", () => {
    const row: Record<string, string> = {
      water_disconnection_flag: "1",
      avg_water_usage: "15.5",
      "建物評価額_ods": "5000000",
      "築年数_ods": "35",
    };

    const result = collectOdsColumns(row);

    expect(result.odsEntries).toEqual([
      { name: "建物評価額", value: "5000000" },
      { name: "築年数", value: "35" },
    ]);
  });

  it("_odsカラムが存在しない場合はodsEntriesがnull", () => {
    const row: Record<string, string> = {
      water_disconnection_flag: "1",
      avg_water_usage: "15.5",
    };

    const result = collectOdsColumns(row);

    expect(result.odsEntries).toBeNull();
    expect(result.row).toEqual(row);
  });

  it("_odsカラムの値が空文字の場合も収集する", () => {
    const row: Record<string, string> = {
      "建物評価額_ods": "",
      "築年数_ods": "35",
    };

    const result = collectOdsColumns(row);

    expect(result.odsEntries).toEqual([
      { name: "建物評価額", value: "" },
      { name: "築年数", value: "35" },
    ]);
  });

  it("返り値のrowから_odsカラムが除去されている", () => {
    const row: Record<string, string> = {
      water_disconnection_flag: "1",
      "建物評価額_ods": "5000000",
      "築年数_ods": "35",
    };

    const result = collectOdsColumns(row);

    expect(result.row).toEqual({ water_disconnection_flag: "1" });
  });

  it("元の行オブジェクトは変更されない（イミュータブル）", () => {
    const row: Record<string, string> = {
      water_disconnection_flag: "1",
      "建物評価額_ods": "5000000",
    };

    collectOdsColumns(row);

    expect(row).toEqual({
      water_disconnection_flag: "1",
      "建物評価額_ods": "5000000",
    });
  });

  it("逆順入力でもアルファベット順で安定する", () => {
    const row: Record<string, string> = {
      "Z_ods": "3",
      "A_ods": "1",
      "M_ods": "2",
    };

    const result = collectOdsColumns(row);

    expect(result.odsEntries).toEqual([
      { name: "A", value: "1" },
      { name: "M", value: "2" },
      { name: "Z", value: "3" },
    ]);
  });

  it("_odsで終わるが意味が異なるカラム名も収集対象になる", () => {
    // _odsサフィックスの判定は純粋な文字列マッチ。
    // "method_ods"も"_ods"で終わるため収集される（これは仕様）。
    const row: Record<string, string> = {
      some_method_ods: "value",
      normal_col: "other",
    };

    const result = collectOdsColumns(row);

    expect(result.odsEntries).toEqual([
      { name: "some_method", value: "value" },
    ]);
    expect(result.row).toEqual({ normal_col: "other" });
  });

  it("空のオブジェクトはodsEntriesがnull", () => {
    const result = collectOdsColumns({});

    expect(result.odsEntries).toBeNull();
    expect(result.row).toEqual({});
  });
});
