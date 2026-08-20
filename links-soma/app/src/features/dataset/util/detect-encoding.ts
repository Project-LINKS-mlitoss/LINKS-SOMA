import { createReadStream } from "fs";

/** 文字コード判定で先頭から読むバイト数の上限。 */
const MAX_BYTES = 64 * 1024;

/**
 * ファイルが UTF-8 として読めないか（＝文字化けする非UTF-8か）を判定する（PV-01）。
 *
 * 読み込み本体は UTF-8 固定（`read-csv-column-values.ts`）なので、非UTF-8 ファイルは
 * 文字化けし、ヘッダー照合が外れて全列が無言 unknown 化する。先頭 MAX_BYTES を
 * `TextDecoder("utf-8", { fatal: true })` で検査し、不正バイト列があれば true。
 *
 * 厳密なエンコーディング特定・自動変換は処理本体（Python chardet）が担う（FR007）。
 * ここは「明らかに非UTF-8」だけを高確信に確定する片側性の事前目安。
 *
 * 偽陽性回避: ストリーム境界やファイル切り詰めで多バイト文字が途切れても
 * `{ stream: true }` が次チャンクに繰り越す。先頭 MAX_BYTES で切り詰めた場合は
 * flush しない（末尾の不完全シーケンスを不正と誤判定しない）。
 */
export const isLikelyNonUtf8 = async (filePath: string): Promise<boolean> => {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const stream = createReadStream(filePath, { end: MAX_BYTES - 1 });
  let read = 0;
  try {
    for await (const chunk of stream) {
      const bytes = chunk as Buffer;
      decoder.decode(bytes, { stream: true });
      read += bytes.length;
    }
    // 全件読了時のみ flush（切り詰めた末尾の不完全文字を誤判定しない）。
    if (read < MAX_BYTES) {
      decoder.decode();
    }
    return false;
  } catch {
    return true;
  }
};
