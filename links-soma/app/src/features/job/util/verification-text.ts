/**
 * 検証情報ダウンロード（NR007 証跡）のテキスト整形。
 *
 * 出来上がりは2部構成。上半分が処理結果画面の動的な情報を写したセクション群、
 * 下半分がジョブ単位の実行ログ（logs.txt）全文。画面を直接見られない相手へ
 * 同じ内容を渡すためのファイルなので、画面に出ている情報を落とさないことが要件。
 */

import { lang } from "../../../shared/config/lang";

const l = lang.components["job-parameters-section"];

/** 検証情報ダウンロードの1セクション */
export type VerificationSection = {
  title?: string;
  rows: [string, string][];
};

/**
 * セクション群を人間可読テキストへ整形する。
 * 行が0件のセクションは出力しない。画面に出ていない項目の空欄を並べないため。
 */
export const sectionsToText = (
  heading: string,
  sections: VerificationSection[],
): string => {
  const lines: string[] = [`# ${heading}`, ""];
  for (const section of sections) {
    if (!section.rows.length) continue;
    if (section.title) lines.push(`【${section.title}】`);
    for (const [label, value] of section.rows) {
      lines.push(`${label}: ${value}`);
    }
    lines.push("");
  }
  return lines.join("\n");
};

/** セクション群の末尾へジョブ単位の実行ログを同梱する。ログが無ければ上半分だけ返す */
export const buildVerificationText = (
  heading: string,
  sections: VerificationSection[],
  logText?: string,
): string => {
  const base = sectionsToText(heading, sections);
  if (!logText) return base;
  const divider = "=".repeat(60);
  return `${base}\n${divider}\n${l.downloadLogHeading}\n${divider}\n${logText}`;
};
