import { isLikelyNonUtf8Bytes } from "./is-likely-non-utf8-bytes";

/** 文字コード検査の先頭読み取り上限（PV-01 と揃える）。 */
const HEAD_BYTES = 64 * 1024;

/**
 * CSV/TXT のみ対象。gpkg/shp 等のバイナリは UTF-8 でないのが正常なので検査しない
 * （誤検出を防ぐ。run-pre-validation の PV-01 ガードと同じ方針）。
 */
const isTextFile = (name: string): boolean => /\.(csv|txt)$/i.test(name);

/**
 * アップロードされた File 群のうち、UTF-8 として読めない（≒Shift_JIS 等）ものの
 * ファイル名を返す（PV-01 のアップロード時・非ブロッキング版）。
 *
 * 各 File の先頭 HEAD_BYTES を renderer 内で検査する（IPC 不要・保存前に判定可能）。
 */
export const detectNonUtf8Files = async (
  files: FileList | File[],
): Promise<string[]> => {
  const flagged: string[] = [];
  for (const file of Array.from(files)) {
    if (!isTextFile(file.name)) continue;
    const buffer = await file.slice(0, HEAD_BYTES).arrayBuffer();
    if (isLikelyNonUtf8Bytes(new Uint8Array(buffer))) {
      flagged.push(file.name);
    }
  }
  return flagged;
};
