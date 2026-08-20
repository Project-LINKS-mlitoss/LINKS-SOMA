import { getFilePathInDatabaseDirectory } from "../../../shared/utils/get-file-path-in-database-directory";
import { mainProcessLogger } from "../../../shared/utils/main-process-logger";
import { type ResolvedReference } from "../pre-validation";
import { type IpcMainListener } from "../../../ipc-main-listeners";
import { runPreValidation, type PreValidationItem } from "./run-pre-validation";

export type preValidateDatasetArgs = {
  /** データセットのファイル名（DBディレクトリ基準）。 */
  filename: string | undefined;
  /** データセット種別（schemaKey）。 */
  schemaKey: string | undefined;
  /** 論理カラムキー → 実カラム名（フォームのマッピング）。 */
  columns: Record<string, string> | undefined;
  /** 論理カラムキー → 論理項目名（画面の行 identity）。省略時は実カラム名。 */
  columnLabels?: Record<string, string>;
  /** クロスファイル参照（親ファイル名・実カラムに解決済み・PV-08）。 */
  references?: ResolvedReference[];
};

export type { PreValidationItem };

/**
 * データセットを事前軽量チェックする IPC（サンプリング・三値・目安）。
 * 取得不能な引数では空配列（事後に委ねる）。
 */
export const preValidateDataset = (async (
  _: unknown,
  {
    filename,
    schemaKey,
    columns,
    columnLabels,
    references,
  }: preValidateDatasetArgs,
): Promise<PreValidationItem[]> => {
  if (!filename || !schemaKey || !columns) {
    return [];
  }
  const filePath = getFilePathInDatabaseDirectory(filename);
  // 親ファイル名を絶対パスに解決（子ファイルと同じ DBディレクトリ基準）
  const referenceChecks = (references ?? []).map((ref) => ({
    parentPath: getFilePathInDatabaseDirectory(ref.parentFilename),
    parentColumn: ref.parentColumn,
    childColumn: ref.childColumn,
    impact: ref.impact,
  }));
  // 失敗（ファイル読込・パース等）は握り潰さず投げ直す。画面側が error を受けて
  // 控えめに通知する（無言で消さない）。事前は目安なので処理自体はブロックしない。
  try {
    return await runPreValidation(
      filePath,
      schemaKey,
      columns,
      referenceChecks,
      columnLabels ?? {},
    );
  } catch (error) {
    mainProcessLogger.error(
      `preValidateDataset failed (schemaKey=${schemaKey})`,
      error instanceof Error ? error : new Error(String(error)),
    );
    throw error;
  }
}) satisfies IpcMainListener;
