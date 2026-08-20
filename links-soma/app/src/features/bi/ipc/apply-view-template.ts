import { asc, eq } from "drizzle-orm";
import {
  data_set_detail_buildings,
  result_views,
  view_templates,
} from "../../../db/schema";
import { db } from "../../../db/client";
import { findSystemViewPreset } from "../config/view-presets";
import { createDefaultLineGroupParameters } from "../util";
import { type ViewTemplateView } from "../types";
import { type IpcMainListener } from "../../../ipc-main-listeners";

/** line ビューに既存のグループ設定が無いか（ユーザーテンプレの意図を上書きしないための判定）。 */
const hasGroupParameter = (view: ViewTemplateView): boolean =>
  view.parameters.some((parameter) => parameter.type === "group");

/**
 * 束ねるデータの reference_date から年グループ（YYYY年ラベル + avg 集計）を生成する。
 * UI で line ビューを新規作成したときの既定（createDefaultLineGroupParameters）と同じ「年度で丸めた折れ線」を、
 * データ非依存なプリセットの適用時に再現する。キーは決定的（group_year_<i>）。
 */
const buildLineYearGroups = async (
  dataSetResultId: number,
): Promise<ViewTemplateView["parameters"]> => {
  const rows = await db
    .selectDistinct({
      reference_date: data_set_detail_buildings.reference_date,
    })
    .from(data_set_detail_buildings)
    .where(eq(data_set_detail_buildings.data_set_result_id, dataSetResultId))
    .orderBy(asc(data_set_detail_buildings.reference_date));
  const dates = rows.map((row) => row.reference_date);
  return createDefaultLineGroupParameters(dates, {
    keyPrefix: "group_year_",
  }) as ViewTemplateView["parameters"];
};

type Params = {
  sheetId: number;
  /** 束ねる推定結果データ。テンプレートはデータ非依存なので適用時に必ず指定する */
  dataSetResultId: number;
  /** `system:<key>` または `user:<dbId>` */
  templateId: string;
};

/** templateId をソース別に解決してビュー定義配列を返す。プリセット定義はサーバ権威。 */
const resolveTemplateViews = async (
  templateId: string,
): Promise<ViewTemplateView[]> => {
  const separator = templateId.indexOf(":");
  const kind = templateId.slice(0, separator);
  const ref = templateId.slice(separator + 1);

  if (kind === "system") {
    const preset = findSystemViewPreset(ref);
    if (!preset) {
      throw new Error(`System view preset not found: ${ref}`);
    }
    return preset.views;
  }

  if (kind === "user") {
    const template = await db
      .select()
      .from(view_templates)
      .where(eq(view_templates.id, Number(ref)))
      .get();
    if (!template) {
      throw new Error(`User view template not found: ${ref}`);
    }
    return template.views;
  }

  throw new Error(`Invalid templateId: ${templateId}`);
};

/**
 * テンプレート（システム/ユーザー）からビュー群をシートに追加する。
 * FR021「プリセット適用」「保存テンプレから再追加」。
 *
 * 各ビューに同一の data_set_result_id を注入して result_views へ一括 insert する。
 * これが「同一の任意データに束ねる」を DB 操作レベルで保証する唯一の箇所。
 *
 * layoutIndex は既存ビューの最大値の後ろに連番で割り当てる（空シートなら 1..N となりテンプレート本来の配置を再現）。
 * 注意: レイアウトテンプレートは4ビューまでしか grid area を持たない（preview-result-sheet.tsx）。
 * 既存ビュー + 束の合計が5以上になると 5番目以降は CSS 未割当になる。UI 側の制約。
 */
export const applyViewTemplate = (async (
  _: unknown,
  { sheetId, dataSetResultId, templateId }: Params,
): Promise<{ insertedIds: number[] }> => {
  const views = await resolveTemplateViews(templateId);

  // 空テンプレートは drizzle の values([]) が失敗するため早期 return
  if (views.length === 0) {
    return { insertedIds: [] };
  }

  // 既存ビューの最大 layoutIndex の後ろに連番で積む。
  // 件数でなく max を基準にするのは layoutIndex に欠番があっても衝突しないため。
  const existing = await db
    .select({ layoutIndex: result_views.layoutIndex })
    .from(result_views)
    .where(eq(result_views.sheet_id, sheetId));
  const offset = Math.max(0, ...existing.map((view) => view.layoutIndex ?? 0));

  // グループ未設定の line ビューには、束ねるデータの年グループを注入して「年度で丸めた折れ線」にする。
  const needsYearGroups = views.some(
    (view) => view.style === "line" && !hasGroupParameter(view),
  );
  const yearGroups = needsYearGroups
    ? await buildLineYearGroups(dataSetResultId)
    : [];

  const rows = views.map((view, index) => ({
    sheet_id: sheetId,
    data_set_result_id: dataSetResultId,
    title: view.title,
    unit: view.unit,
    style: view.style,
    layoutIndex: offset + index + 1,
    parameters:
      view.style === "line" && !hasGroupParameter(view)
        ? [...view.parameters, ...yearGroups]
        : view.parameters,
  }));

  const inserted = await db
    .insert(result_views)
    .values(rows)
    .returning({ insertedId: result_views.id })
    .all();

  return { insertedIds: inserted.map((row) => row.insertedId) };
}) satisfies IpcMainListener;
