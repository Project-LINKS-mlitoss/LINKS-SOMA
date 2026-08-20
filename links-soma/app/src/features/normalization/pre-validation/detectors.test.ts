import { describe, expect } from "vitest";
import {
  dataTypeNumeric,
  dateFormat,
  missingValue,
  uniqueness,
  valueRange,
} from "./detectors";
import type { SampleColumn } from "./types";

const sampled = (values: string[]): SampleColumn => ({
  values,
  truncated: true,
});
const full = (values: string[]): SampleColumn => ({
  values,
  truncated: false,
});

describe("uniqueness（片側性: issue 側を確定）", (it) => {
  it("サンプル内に重複が出れば issue を確定する", () => {
    expect(uniqueness(sampled(["1", "2", "1"])).status).toBe("issue");
  });

  it("issue は文言キーと重複値を返す（文章化は画面側 lang.ts）", () => {
    expect(uniqueness(sampled(["1", "2", "1"])).message).toEqual({
      key: "uniquenessDuplicate",
      params: { value: "1" },
    });
  });

  it("サンプル内に重複が無く打ち切りなら unknown（事後へ委ねる）", () => {
    expect(uniqueness(sampled(["1", "2", "3"])).status).toBe("unknown");
  });

  it("全件読了で重複が無ければ clear を確定する", () => {
    expect(uniqueness(full(["1", "2", "3"])).status).toBe("clear");
  });

  it("空文字は欠損観点の責務なので一意性判定から除外する", () => {
    expect(uniqueness(sampled(["", "", "1"])).status).toBe("unknown");
  });
});

describe("dataTypeNumeric（数値形式・issue側を確定）", (it) => {
  it("数値でない値があれば issue", () => {
    expect(dataTypeNumeric(sampled(["1", "x", "3"])).status).toBe("issue");
  });
  it("全件数値で全件読了なら clear", () => {
    expect(dataTypeNumeric(full(["1", "2"])).status).toBe("clear");
  });
  it("全件数値でも打ち切りなら unknown", () => {
    expect(dataTypeNumeric(sampled(["1", "2"])).status).toBe("unknown");
  });
  it("16進リテラル(0x10)は Python(pd.to_numeric) が弾くので issue", () => {
    // JS の Number('0x10')=16 だが Python は NaN 化するため整合させる。
    expect(dataTypeNumeric(full(["1", "0x10"])).status).toBe("issue");
  });
});

describe("valueRange（値域・issue側を確定）", (it) => {
  it("範囲外があれば issue", () => {
    expect(valueRange(full(["10", "200"]), -90, 90).status).toBe("issue");
  });
  it("全件範囲内で全件読了なら clear", () => {
    expect(valueRange(full(["0", "45"]), -90, 90).status).toBe("clear");
  });
});

describe("missingValue（必須欠損なし・issue側を確定）", (it) => {
  it("空文字があれば issue", () => {
    expect(missingValue(sampled(["1", "", "2"])).status).toBe("issue");
  });
  it("欠損なし全件読了なら clear", () => {
    expect(missingValue(full(["1", "2"])).status).toBe("clear");
  });
});

describe("dateFormat（日付形式・issue側を確定）", (it) => {
  it("既知形式に当てはまらない値があれば issue", () => {
    expect(dateFormat(full(["2024-01-01", "不明"])).status).toBe("issue");
  });
  it("ISO形式(yyyy-mm-dd)は clear", () => {
    expect(dateFormat(full(["2024-01-01"])).status).toBe("clear");
  });
  it("Python正準の8桁(yyyymmdd)を clear（new Date誤検出のリグレッション防止）", () => {
    // Python は '%Y%m%d' で受理。旧実装の new Date('20220411')=NaN を防ぐ。
    expect(dateFormat(full(["20220411", "19810321"])).status).toBe("clear");
  });
  it("和暦・日本語年月日も既知形式として clear", () => {
    expect(dateFormat(full(["令和5年4月11日", "2024年1月1日"])).status).toBe(
      "clear",
    );
  });
});
