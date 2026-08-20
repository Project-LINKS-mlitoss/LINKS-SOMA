/** 文字コード判定で先頭から読むバイト数の上限。PV-01（detect-encoding.ts）と揃える。 */
const MAX_BYTES = 64 * 1024;

/**
 * バイト列が UTF-8 として読めないか（＝文字化けする非UTF-8か）を判定する（PV-01 のバイト列版）。
 *
 * main プロセスの `isLikelyNonUtf8`（ファイルパス＋fs ストリーム）と同じ判定意味論を、
 * renderer で扱える `Uint8Array`（アップロード File の arrayBuffer など）向けに提供する。
 * TextDecoder は renderer/main 双方で利用できるため fs に依存しない。
 *
 * 偽陽性回避: 先頭 MAX_BYTES で切り詰めた場合は flush しない（末尾の不完全な多バイト
 * 文字を不正と誤判定しない）。全体を読めた場合のみ flush して末尾まで検査する。
 *
 * 呼び出し側は先頭 MAX_BYTES バイトだけを slice して渡すため、MAX_BYTES に達した時点で
 * 「より大きいファイルの先頭」の可能性があり全体を読めたとは断定できない。よって長さが
 * MAX_BYTES 以上なら truncated 扱いにして flush しない（ストリーム版 detect-encoding.ts の
 * `read < MAX_BYTES` ガードと同一意味論。64KB 境界で多バイト文字が割れる偽陽性を防ぐ）。
 */
export const isLikelyNonUtf8Bytes = (bytes: Uint8Array): boolean => {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const truncated = bytes.length >= MAX_BYTES;
  const head = truncated ? bytes.subarray(0, MAX_BYTES) : bytes;
  try {
    decoder.decode(head, { stream: true });
    if (!truncated) {
      decoder.decode();
    }
    return false;
  } catch {
    return true;
  }
};
