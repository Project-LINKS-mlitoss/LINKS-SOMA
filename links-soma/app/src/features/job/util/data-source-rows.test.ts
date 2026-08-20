import { describe, expect, it } from "vitest";
import { lang } from "../../../shared/config/lang";
import {
  buildingTypeValuesText,
  dataSourceExtras,
  dataSourceValueText,
  formatBytes,
  formatVolume,
} from "./data-source-rows";

const l = lang.components["job-parameters-section"];

describe("formatBytes", () => {
  it("1024 未満はバイトのまま、超えたら単位を繰り上げる", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(1024 ** 3)).toBe("1.0 GB");
  });

  it("GB より上は繰り上げず GB で表す。TB 規模の入力を想定しないため", () => {
    expect(formatBytes(1024 ** 4)).toBe("1024.0 GB");
  });
});

describe("formatVolume", () => {
  it("CSV は行数とサイズを併記する", () => {
    expect(formatVolume({ bytes: 2048, rows: 1234 })).toBe("1,234行 / 2.0 KB");
  });

  it("行数が取れないファイル形式はサイズだけ出す", () => {
    expect(formatVolume({ bytes: 2048, rows: null })).toBe("2.0 KB");
  });

  it("ファイルが読めなければ値を作らない。0行と区別するため", () => {
    expect(formatVolume(undefined)).toBeUndefined();
  });
});

describe("dataSourceExtras", () => {
  it("持たない項目は飛ばす。入力データの種類ごとに持つ項目が違うため", () => {
    expect(dataSourceExtras({})).toEqual([]);
    expect(dataSourceExtras({ data_type: "plateau" })).toEqual(["PLATEAU"]);
    expect(dataSourceExtras({ input_file_type: "csv" })).toEqual(["CSV"]);
  });

  it("空文字は足さない。括弧の中身が空のまま出てしまうため", () => {
    expect(dataSourceExtras({ data_type: "", input_file_type: "" })).toEqual(
      [],
    );
    expect(dataSourceExtras({ data_type: "", input_file_type: "csv" })).toEqual(
      ["CSV"],
    );
  });

  it("両方持つデータは データ種別 → ファイル形式 の順に並べる", () => {
    expect(
      dataSourceExtras({ data_type: "others", input_file_type: "geopackage" }),
    ).toEqual(["その他", "GeoPackage"]);
  });

  it("未知の値はそのまま出す。表示が空になるのを避けるため", () => {
    expect(
      dataSourceExtras({ data_type: "unknown", input_file_type: "parquet" }),
    ).toEqual(["unknown", "parquet"]);
  });
});

describe("buildingTypeValuesText", () => {
  it("指定された家屋種別を並べる", () => {
    expect(buildingTypeValuesText(["専用住宅", "併用住宅"])).toBe(
      "専用住宅 / 併用住宅",
    );
  });

  it("空配列でも文字列を返す。絞り込まなかったことと記録漏れを区別するため", () => {
    expect(buildingTypeValuesText([])).toBe(l.buildingTypeValuesNone);
    expect(buildingTypeValuesText(undefined)).toBe(l.buildingTypeValuesNone);
  });
});

describe("dataSourceValueText", () => {
  it("ファイル名・付随情報・データ量を1行へ連結する", () => {
    expect(
      dataSourceValueText(
        "建物.gpkg",
        { data_type: "plateau", input_file_type: "geopackage" },
        { bytes: 5120, rows: null },
      ),
    ).toBe("建物.gpkg (PLATEAU, GeoPackage)（5.0 KB）");
  });

  it("付随情報が無ければ括弧を出さない", () => {
    expect(dataSourceValueText("水道.csv", {}, { bytes: 512, rows: 10 })).toBe(
      "水道.csv（10行 / 512 B）",
    );
  });

  it("データ量が取れなくてもファイル名は残す。ファイルが消えていても何を使ったか読めるため", () => {
    expect(
      dataSourceValueText("水道.csv", { input_file_type: "csv" }, undefined),
    ).toBe("水道.csv (CSV)");
    expect(dataSourceValueText("水道.csv", {}, undefined)).toBe("水道.csv");
  });
});
