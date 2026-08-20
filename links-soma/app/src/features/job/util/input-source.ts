/**
 * 結合元データの説明文の整形。
 *
 * 名寄せの結合率タスクは「「水道閉開栓状況」に「住民基本台帳」を住所で結合（A）」の
 * ような説明を `input_source` に持つ。処理結果画面の「処理の種類」列とエラー行の
 * 括弧書きがこれを表示している。
 *
 * Python は1本の文字列を書き込むが、型は配列も許す。両方を同じ文字列へ畳む。
 */
export const formatInputSource = (
  source: string[] | string | undefined | null,
): string => {
  if (!source) return "";
  return Array.isArray(source) ? source.join(", ") : String(source);
};
