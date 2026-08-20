import { describe, expect, it } from "vitest";
import {
  toDisplayHeaderLine,
  toStorageHeaderLine,
  translateCsvHeaderBytes,
  translateCsvHeaderParts,
} from "./normalized-csv-header";

const STORAGE_HEADER =
  "正規化住所,水道番号,is_vacant,vacant_type,vacant_source,vacant_year,address_precision_flag,世帯コード_ods";
const DISPLAY_HEADER =
  "正規化住所,水道番号,空き家,空き家区分,空き家調査元,空き家調査年度,調査住所精度不足フラグ,[追加] 世帯コード";

describe("名寄せ済みデータのヘッダ読み替え", () => {
  it("空き家調査結果5列と建物関連データを表示名にする", () => {
    expect(toDisplayHeaderLine(STORAGE_HEADER)).toBe(DISPLAY_HEADER);
  });

  it("表示名をディスク上の列名に戻す", () => {
    expect(toStorageHeaderLine(DISPLAY_HEADER)).toBe(STORAGE_HEADER);
  });

  /** 片方向だけ変えるとアップロードで壊れるため、対称性を固定する */
  it("読み替えは対称", () => {
    expect(toStorageHeaderLine(toDisplayHeaderLine(STORAGE_HEADER))).toBe(
      STORAGE_HEADER,
    );
    expect(toDisplayHeaderLine(toStorageHeaderLine(DISPLAY_HEADER))).toBe(
      DISPLAY_HEADER,
    );
  });

  it("対象外の列は素通りさせる", () => {
    const line = "正規化住所,residenceID,reference_date,世帯人数";
    expect(toDisplayHeaderLine(line)).toBe(line);
    expect(toStorageHeaderLine(line)).toBe(line);
  });

  /** 外部で作った英語ヘッダのCSVをアップロードしても壊さない */
  it("既にディスク上の列名で書かれたヘッダは変えない", () => {
    expect(toStorageHeaderLine(STORAGE_HEADER)).toBe(STORAGE_HEADER);
  });
});

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
const decode = (bytes: Uint8Array): string =>
  new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);

describe("CSVバイト列のヘッダ読み替え", () => {
  it("ヘッダ行だけを置き換え、本文は保持する", () => {
    const csv = `${STORAGE_HEADER}\n東京都千代田区1-1,W0001,1,空き家,,,,X\n`;
    const result = decode(
      translateCsvHeaderBytes(encode(csv), toDisplayHeaderLine),
    );
    expect(result).toBe(
      `${DISPLAY_HEADER}\n東京都千代田区1-1,W0001,1,空き家,,,,X\n`,
    );
  });

  it("BOMを保持する", () => {
    const bom = "\ufeff";
    const csv = `${bom}${STORAGE_HEADER}\n値\n`;
    const result = translateCsvHeaderBytes(encode(csv), toDisplayHeaderLine);
    expect(result[0]).toBe(0xef);
    expect(result[1]).toBe(0xbb);
    expect(result[2]).toBe(0xbf);
    expect(decode(result)).toBe(`${bom}${DISPLAY_HEADER}\n値\n`);
  });

  /** Windows で編集して保存すると CRLF になる。末尾の列も読み替える */
  it("CRLFでも末尾の列を読み替え、改行を保つ", () => {
    const csv = `${STORAGE_HEADER}\r\n値\r\n`;
    const result = decode(
      translateCsvHeaderBytes(encode(csv), toDisplayHeaderLine),
    );
    expect(result).toBe(`${DISPLAY_HEADER}\r\n値\r\n`);
  });

  it("CRLFでも読み替えは対称", () => {
    const csv = `${STORAGE_HEADER}\r\n値\r\n`;
    const display = translateCsvHeaderBytes(encode(csv), toDisplayHeaderLine);
    const storage = translateCsvHeaderBytes(display, toStorageHeaderLine);
    expect(decode(storage)).toBe(csv);
  });

  it("改行が無ければ元のバイト列を返す", () => {
    const bytes = encode(STORAGE_HEADER);
    expect(translateCsvHeaderBytes(bytes, toDisplayHeaderLine)).toBe(bytes);
  });

  /**
   * 取り込みは非UTF-8を許容する（PV-01）。読み替えると本文と食い違い、
   * 日本語の列名が置換文字で壊れる
   */
  it("UTF-8として解釈できないヘッダは触らない", () => {
    // Shift_JIS の「正規化住所」+ ASCII の is_vacant
    const sjisHeader = new Uint8Array([
      0x90, 0xb3, 0x8b, 0x4b, 0x89, 0xbb, 0x8f, 0x5a, 0x8f, 0x8a, 0x2c,
    ]);
    const rest = encode("is_vacant\n値\n");
    const bytes = new Uint8Array(sjisHeader.length + rest.length);
    bytes.set(sjisHeader);
    bytes.set(rest, sjisHeader.length);

    expect(translateCsvHeaderBytes(bytes, toDisplayHeaderLine)).toBe(bytes);
  });

  it("読み替えるときはヘッダと本文を分けて返す", () => {
    const csv = `${STORAGE_HEADER}\n値\n`;
    const parts = translateCsvHeaderParts(encode(csv), toDisplayHeaderLine);
    expect(parts).toHaveLength(2);
    expect(decode(parts[0])).toBe(DISPLAY_HEADER);
    expect(decode(parts[1])).toBe("\n値\n");
  });

  it("読み替える列が無ければ元のバイト列を返す", () => {
    const bytes = encode("正規化住所,世帯人数\n値,1\n");
    expect(translateCsvHeaderBytes(bytes, toDisplayHeaderLine)).toBe(bytes);
  });
});
