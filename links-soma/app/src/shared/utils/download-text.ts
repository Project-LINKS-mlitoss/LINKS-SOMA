/**
 * 任意のテキストをファイルとしてダウンロードさせる（NR007 検証情報の証跡出力）。
 * Blob + 一時アンカーで保存ダイアログを開く。
 */
export const downloadText = (fileName: string, content: string): void => {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};
