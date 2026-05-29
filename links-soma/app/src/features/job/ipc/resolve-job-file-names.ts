import { inArray, eq } from "drizzle-orm";
import {
  raw_data_sets,
  normalized_data_sets,
  model_files,
  data_set_results,
  result_views,
  result_sheets,
} from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";
import {
  type ResolveJobFileNamesRequest,
  type ResolveJobFileNamesResponse,
} from "../types/resolve-job-file-names";

/**
 * job.parameters内のUUIDパスやIDをユーザー表示名に一括変換する
 * 1回のIPC呼び出しで必要な全表示名を解決し、通信コストを最小化する
 */
export const resolveJobFileNames = (async (
  _: unknown,
  params: ResolveJobFileNamesRequest,
): Promise<ResolveJobFileNamesResponse> => {
  const result: ResolveJobFileNamesResponse = {
    rawNames: {},
    normalizedNames: {},
    modelName: null,
    dataSetResultTitle: null,
    viewTitle: null,
    viewRoute: null,
  };

  // raw_data_sets: file_path → file_name
  if (params.rawPaths && params.rawPaths.length > 0) {
    const rows = await db
      .select({
        file_path: raw_data_sets.file_path,
        file_name: raw_data_sets.file_name,
      })
      .from(raw_data_sets)
      .where(inArray(raw_data_sets.file_path, params.rawPaths))
      .all();
    for (const row of rows) {
      result.rawNames[row.file_path] = row.file_name;
    }
  }

  // normalized_data_sets: file_path → file_name
  if (params.normalizedPaths && params.normalizedPaths.length > 0) {
    const rows = await db
      .select({
        file_path: normalized_data_sets.file_path,
        file_name: normalized_data_sets.file_name,
      })
      .from(normalized_data_sets)
      .where(inArray(normalized_data_sets.file_path, params.normalizedPaths))
      .all();
    for (const row of rows) {
      result.normalizedNames[row.file_path] = row.file_name ?? null;
    }
  }

  // model_files: file_path → file_name
  if (params.modelPath) {
    const row = await db
      .select({ file_name: model_files.file_name })
      .from(model_files)
      .where(eq(model_files.file_path, params.modelPath))
      .get();
    result.modelName = row?.file_name ?? null;
  }

  // data_set_results: id → title
  if (params.dataSetResultId) {
    const row = await db
      .select({ title: data_set_results.title })
      .from(data_set_results)
      .where(eq(data_set_results.id, params.dataSetResultId))
      .get();
    result.dataSetResultTitle = row?.title ?? null;
  }

  // result_views: id → title + ルーティング情報（sheet_id, workbook_id）
  if (params.viewId) {
    const row = await db
      .select({
        title: result_views.title,
        sheetId: result_views.sheet_id,
        workbookId: result_sheets.workbook_id,
      })
      .from(result_views)
      .leftJoin(result_sheets, eq(result_views.sheet_id, result_sheets.id))
      .where(eq(result_views.id, params.viewId))
      .get();
    result.viewTitle = row?.title ?? null;
    if (row?.workbookId && row?.sheetId) {
      result.viewRoute = {
        workbookId: row.workbookId,
        sheetId: row.sheetId,
        viewId: params.viewId,
      };
    }
  }

  return result;
}) satisfies IpcMainListener;
