/**
 * 配列で渡すと Blob が連結するため、呼び出し側で全体をコピーせずに済む。
 * 数百MBのデータセットでヘッダだけ差し替える用途で使う。
 */
export function downloadDataSetFile(
  buffer: Buffer | Uint8Array | Uint8Array[],
  fileName: string,
): void {
  const parts = Array.isArray(buffer) ? buffer : [buffer];
  const url = URL.createObjectURL(new Blob(parts));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
