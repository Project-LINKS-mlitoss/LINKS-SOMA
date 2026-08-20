/**
 * エラー内容を検証情報ダウンロードのセクションへ整形する（#1987）。
 *
 * 処理結果画面の赤いボックス（ErrorJobTaskInfo / ErrorDetailView）に出ている情報を
 * そのまま写す。画面では折りたたみの中にある修正方法も、動的な情報として含める。
 */

import { type SelectJob, type SelectJobTask } from "../../../db/schema";
import { lang } from "../../../shared/config/lang";
import { type FixGuide } from "../../../shared/types/job-task-result";
import { formatInputSource } from "./input-source";
import { type VerificationSection } from "./verification-text";

const l = lang.components["job-parameters-section"];
const t = lang.components.errorDisplay;

/**
 * 修正方法を行へ展開する。
 * 画面は「何が問題か」「正しい形式（箇条書き）」「修正例（複数）」を縦に並べるが、
 * ファイルは `ラベル: 値` の1行しか持てないため、複数値は ` / ` で連結する。
 */
const fixGuideRows = (guide: FixGuide): [string, string][] => {
  const rows: [string, string][] = [[l.errorFixGuide, guide.what]];
  if (guide.accepted?.length) {
    rows.push([l.errorFixGuideAccepted, guide.accepted.join(" / ")]);
  }
  if (guide.examples?.length) {
    rows.push([
      l.errorFixGuideExample,
      guide.examples.map((ex) => `${ex.before} → ${ex.after}`).join(" / "),
    ]);
  }
  return rows;
};

/**
 * エラーメッセージ1行。画面はメッセージの後ろへ、どのデータで起きたかを括弧で添える
 * （ErrorJobTaskInfo）。データ名が無いとどの入力を直せばよいか読み取れないため、
 * ファイルも同じ形で書き出す。
 */
const errorMessageValue = (task: SelectJobTask): string => {
  const message = task.error_msg ?? "";
  const result = task.result;
  if (result?.taskResultType !== "preprocess") return message;
  const sources = formatInputSource(result.input_source);
  return sources ? `${message}（${sources}）` : message;
};

/** 失敗タスク1件を行へ展開する */
const taskRows = (task: SelectJobTask): [string, string][] => {
  const rows: [string, string][] = [[l.errorMessage, errorMessageValue(task)]];

  const detail = task.result?.error_detail;
  if (!detail) return rows;

  rows.push([
    l.errorResponsibility,
    t.action[detail.responsibility] ?? detail.responsibility,
  ]);
  if (detail.next_action) rows.push([l.errorNextAction, detail.next_action]);
  if (detail.fix_guide) rows.push(...fixGuideRows(detail.fix_guide));
  return rows;
};

/**
 * 失敗したタスクからエラーセクションを組み立てる。エラーが無ければ空配列。
 *
 * 1タスク = 1セクションにする。複数エラーを1セクションへ並べると同じラベルが
 * 繰り返され、どの修正方法がどのエラーのものか読めなくなるため。画面も
 * タスクごとに別ブロックで表示している。
 * 複数ある場合だけ見出しに番号を添える（1件のときに「1件目」と書かない）。
 */
export const toErrorSections = (
  tasks: SelectJobTask[] | undefined,
  jobStatus?: SelectJob["status"],
): VerificationSection[] => {
  const failed = (tasks ?? []).filter((task) => task.error_msg);
  if (!failed.length) {
    // 失敗したのにメッセージを持つタスクが1件も無い経路がある（タスク作成前の中断）。
    // ここで行を出さないと、ファイルからは失敗した事実そのものが消える。
    // 画面は同じ状態で「不明のエラーが発生しました」を出している（ErrorJobTaskInfo）
    if (jobStatus === "error") {
      return [
        { title: l.errorSection, rows: [[l.errorMessage, l.errorUnknown]] },
      ];
    }
    return [];
  }

  return failed.map((task, index) => ({
    title: failed.length > 1 ? `${l.errorSection}${index + 1}` : l.errorSection,
    rows: taskRows(task),
  }));
};
