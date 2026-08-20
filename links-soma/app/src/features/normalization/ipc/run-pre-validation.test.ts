import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, beforeAll, describe, expect } from "vitest";
import { runPreValidation } from "./run-pre-validation";

let dir: string;

const writeCsv = (name: string, content: string): string => {
  const path = join(dir, name);
  writeFileSync(path, content, "utf-8");
  return path;
};

const writeBytes = (name: string, bytes: Buffer): string => {
  const path = join(dir, name);
  writeFileSync(path, bytes);
  return path;
};

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "pv-ipc-"));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("runPreValidation（ファイル→画面表示の貫通）", (it) => {
  it("水道番号が重複しても一意性の項目を出さない", async () => {
    // 1メーターに開栓・閉栓の履歴行が並ぶのは正常で、本体（water.py）が水道番号を
    // 一意化してから使う。重複を warn すると利用者に不要な修正を促す偽陽性になる。
    const path = writeCsv("dup.csv", "水道番号,住所\n1,a\n1,b\n");
    const items = await runPreValidation(path, "water_status", {
      water_supply_number: "水道番号",
    });
    expect(items.some((i) => i.code === "PV-07")).toBe(false);
    expect(items.some((i) => i.aspectKey === "uniqueness")).toBe(false);
    // 他観点は出続ける（空配列に退化していないことを確かめ、不在アサートを空振りさせない）。
    expect(
      items.some((i) => i.code === "PV-06" && i.column === "水道番号"),
    ).toBe(true);
  });

  it("同一実カラムに割り当てた複数項目を論理項目名で区別する（誤マッピングの可視化）", async () => {
    // 開栓年月・閉栓年月の両方を実カラム「水道番号」に割り当てた誤マッピング。
    // 行を実カラム名で名乗ると2行とも「水道番号」で区別不能になるが、論理項目名で分かれる。
    const path = writeCsv("collide.csv", "水道番号\nD0001\nD0001\n");
    const items = await runPreValidation(
      path,
      "water_status",
      {
        water_supply_number: "水道番号",
        water_connection_date: "水道番号",
        water_disconnection_date: "水道番号",
      },
      [],
      {
        water_connection_date: "水道開栓年月",
        water_disconnection_date: "水道閉栓年月",
      },
    );
    const dateCols = items
      .filter((i) => i.code === "PV-09")
      .map((i) => i.column);
    expect(new Set(dateCols).size).toBe(2);
    expect(dateCols).toContain("水道開栓年月");
    expect(dateCols).toContain("水道閉栓年月");
    expect(dateCols).not.toContain("水道番号");
  });

  it("欠損なし全件読了なら必須欠損なしは ok", async () => {
    const path = writeCsv("ok.csv", "水道番号\n1\n2\n3\n");
    const items = await runPreValidation(path, "water_status", {
      water_supply_number: "水道番号",
    });
    const missing = items.find((i) => i.code === "PV-06");
    expect(missing?.status).toBe("ok");
  });

  it("カタログに無いデータセットは空配列（事後に委ねる）", async () => {
    const path = writeCsv("x.csv", "a\n1\n");
    const items = await runPreValidation(path, "unknown_dataset", {
      address: "a",
    });
    expect(items).toEqual([]);
  });

  it("未マッピング（空）のカラムは行を出さずスキップする", async () => {
    // water_status は4観点だが、対応づけたのは水道番号のみ（残りは空）。
    const path = writeCsv("partial.csv", "水道番号\n1\n2\n3\n");
    const items = await runPreValidation(path, "water_status", {
      water_supply_number: "水道番号",
      water_connection_date: "",
      water_disconnection_date: "",
      address: "",
    });
    // 水道番号に紐づく1観点（必須欠損なし PV-06）だけが出る
    expect(items).toHaveLength(1);
    expect(items.every((i) => i.column === "水道番号")).toBe(true);
    // 未マッピングの日付形式（PV-09）は出ない
    expect(items.some((i) => i.code === "PV-09")).toBe(false);
  });
});

describe("runPreValidation（文字コード PV-01・ファイル単位）", (it) => {
  it("非UTF-8ファイルは文字コード warn のみ出し列チェックは抑制する", async () => {
    // 「東京」の Shift_JIS バイト列をヘッダーに含む（UTF-8 として不正）。
    const sjis = Buffer.concat([
      Buffer.from([0x93, 0x8c, 0x8b, 0x9e]),
      Buffer.from("\n1\n2\n", "utf-8"),
    ]);
    const path = writeBytes("sjis.csv", sjis);
    const items = await runPreValidation(path, "water_status", {
      water_supply_number: "水道番号",
    });
    // 文字コード警告1件のみ（列チェックは文字化けで誤動作するため事後に委ねる）。
    expect(items).toEqual([
      {
        code: "PV-01",
        status: "warn",
        message: "",
        messageKey: "encodingNotUtf8",
        column: "",
        aspectKey: "encoding",
      },
    ]);
  });

  it("UTF-8ファイルは文字コード行を出さず通常の列チェックを行う", async () => {
    const path = writeCsv("utf8.csv", "水道番号\n1\n2\n3\n");
    const items = await runPreValidation(path, "water_status", {
      water_supply_number: "水道番号",
    });
    expect(items.some((i) => i.code === "PV-01")).toBe(false);
    expect(items.find((i) => i.code === "PV-06")?.status).toBe("ok");
  });

  it("非CSV（gpkg等バイナリ）は文字コード判定しない（誤検出を防ぐ）", async () => {
    // バイナリ（UTF-8 として不正）だが gpkg は UTF-8 でないのが正常。
    const binary = Buffer.from([
      0x47, 0x50, 0x4b, 0x47, 0x00, 0xff, 0xfe, 0x93,
    ]);
    const path = writeBytes("polygon.gpkg", binary);
    const items = await runPreValidation(path, "building_polygon", {});
    expect(items.some((i) => i.code === "PV-01")).toBe(false);
  });
});

describe("runPreValidation（前後関係 PV-10・取り違えガード）", (it) => {
  it("開栓日>閉栓日（逆転）を warn で示す", async () => {
    const path = writeCsv(
      "order.csv",
      "水道番号,開栓日,閉栓日\nA001,20230101,20220101\n",
    );
    const items = await runPreValidation(path, "water_status", {
      water_supply_number: "水道番号",
      water_connection_date: "開栓日",
      water_disconnection_date: "閉栓日",
    });
    expect(items).toContainEqual({
      code: "PV-10",
      status: "warn",
      message: "",
      messageKey: "dateOrderReversed",
      messageParams: { earlier: "20230101", later: "20220101" },
      column: "開栓日・閉栓日",
      aspectKey: "date_order",
    });
  });

  it("開栓日<閉栓日（正順）全件読了なら前後関係は ok", async () => {
    const path = writeCsv(
      "order-ok.csv",
      "水道番号,開栓日,閉栓日\nA001,20220101,20230101\n",
    );
    const items = await runPreValidation(path, "water_status", {
      water_supply_number: "水道番号",
      water_connection_date: "開栓日",
      water_disconnection_date: "閉栓日",
    });
    expect(items.find((i) => i.code === "PV-10")?.status).toBe("ok");
  });

  it("どちらかの日付カラムが未マッピングなら前後関係は出さない", async () => {
    const path = writeCsv(
      "order-partial.csv",
      "水道番号,開栓日\nA001,20220101\n",
    );
    const items = await runPreValidation(path, "water_status", {
      water_supply_number: "水道番号",
      water_connection_date: "開栓日",
    });
    expect(items.some((i) => i.code === "PV-10")).toBe(false);
  });
});

describe("runPreValidation（クロスファイル参照整合 PV-08）", (it) => {
  it("子の水道番号が親に無ければ参照整合を warn で示す", async () => {
    const parent = writeCsv("parent.csv", "水道番号\nA001\nA002\n");
    const child = writeCsv("child.csv", "給水番号\nA001\nB999\n");
    const items = await runPreValidation(
      child,
      "water_usage",
      { water_supply_number: "給水番号" },
      [
        {
          parentPath: parent,
          parentColumn: "水道番号",
          childColumn: "給水番号",
          impact: "continue",
        },
      ],
    );
    expect(items).toContainEqual({
      code: "PV-08",
      status: "warn",
      message: "",
      messageKey: "referenceNotFound",
      messageParams: { value: "B999" },
      column: "給水番号",
      aspectKey: "reference",
    });
  });

  it("子が全件親に在り全件読了なら参照整合は ok", async () => {
    const parent = writeCsv("parent2.csv", "水道番号\nA001\nA002\n");
    const child = writeCsv("child2.csv", "給水番号\nA001\nA002\n");
    const items = await runPreValidation(
      child,
      "water_usage",
      { water_supply_number: "給水番号" },
      [
        {
          parentPath: parent,
          parentColumn: "水道番号",
          childColumn: "給水番号",
          impact: "continue",
        },
      ],
    );
    expect(items.find((i) => i.code === "PV-08")?.status).toBe("ok");
  });
});
