import { describe, expect, it } from "vitest";
import { expandOptionalDataSource } from "./expand-optional-data-source";

describe("expandOptionalDataSource", () => {
  it("JSON配列の各entryを個別カラムとしてdata・columnsに展開する", () => {
    const rows = [
      {
        area_group: "A町",
        predicted_probability: 0.85,
        optional_data_source: [
          { name: "築年数", value: 35 },
          { name: "接道幅", value: 4.2 },
        ],
      },
      {
        area_group: "B町",
        predicted_probability: 0.23,
        optional_data_source: [
          { name: "築年数", value: 12 },
          { name: "接道幅", value: 6.0 },
        ],
      },
    ];

    const result = expandOptionalDataSource(rows);

    expect(result.columns).toEqual([
      { key: "築年数", label: "築年数(追加)", unit: "" },
      { key: "接道幅", label: "接道幅(追加)", unit: "" },
    ]);
    expect(result.data[0]).toMatchObject({
      area_group: "A町",
      predicted_probability: 0.85,
      築年数: 35,
      接道幅: 4.2,
    });
    expect(result.data[1]).toMatchObject({
      area_group: "B町",
      predicted_probability: 0.23,
      築年数: 12,
      接道幅: 6.0,
    });
  });

  it("optional_data_sourceがnullの行は追加カラムが空文字になる", () => {
    const rows = [
      {
        area_group: "A町",
        optional_data_source: [{ name: "築年数", value: 35 }],
      },
      {
        area_group: "B町",
        optional_data_source: null,
      },
    ];

    const result = expandOptionalDataSource(rows);

    expect(result.columns).toEqual([
      { key: "築年数", label: "築年数(追加)", unit: "" },
    ]);
    expect(result.data[0]).toMatchObject({ area_group: "A町", 築年数: 35 });
    expect(result.data[1]).toMatchObject({ area_group: "B町", 築年数: "" });
  });

  it("全行のoptional_data_sourceがnullの場合、columnsは空でdataは元のまま", () => {
    const rows = [
      { area_group: "A町", optional_data_source: null },
      { area_group: "B町", optional_data_source: null },
    ];

    const result = expandOptionalDataSource(rows);

    expect(result.columns).toEqual([]);
    expect(result.data[0]).toEqual({ area_group: "A町" });
    expect(result.data[1]).toEqual({ area_group: "B町" });
  });

  it("optional_data_sourceフィールドが存在しない行はスキップされる", () => {
    const rows = [{ area_group: "A町" }, { area_group: "B町" }];

    const result = expandOptionalDataSource(rows);

    expect(result.columns).toEqual([]);
    expect(result.data[0]).toEqual({ area_group: "A町" });
  });

  it("空配列は空でdata元のまま", () => {
    const result = expandOptionalDataSource([]);

    expect(result.columns).toEqual([]);
    expect(result.data).toEqual([]);
  });

  it("value型がstringの場合もそのまま展開される", () => {
    const rows = [
      {
        area_group: "A町",
        optional_data_source: [{ name: "用途地域", value: "第一種住居地域" }],
      },
    ];

    const result = expandOptionalDataSource(rows);

    expect(result.data[0]).toMatchObject({
      area_group: "A町",
      用途地域: "第一種住居地域",
    });
  });
});
