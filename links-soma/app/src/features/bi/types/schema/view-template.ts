/**
 * ビューテンプレート（FR021: ビュープリセット・名前付き保存）のスキーマ。
 *
 * テンプレート = result_views から sheet_id / data_set_result_id を抜いた「ビュー定義の集合」。
 * 適用時に推定結果データ（data_set_result_id）を毎回選び直すため、テンプレート自体はデータ非依存。
 */

import { z } from "zod";
import { VIEW_STYLES } from "../../../../shared/config/view-styles";
import { parameterSchema } from "./parameter";

/** テンプレート内の1ビュー定義（result_views から sheet_id / data_set_result_id を除いた形） */
export const viewTemplateViewSchema = z.object({
  title: z.string(),
  unit: z.enum(["building", "area"]),
  style: z.enum(VIEW_STYLES),
  /** レイアウトの順序（1〜）。result_views.layoutIndex と同義 */
  layoutIndex: z.number(),
  parameters: parameterSchema.array(),
});

/** ビューテンプレート本体（名前付きで保存されるビュー群の定義） */
export const viewTemplateSchema = z.object({
  name: z.string(),
  /** 業務的な意図の説明（任意）。一覧カードに表示する */
  description: z.string().optional(),
  views: viewTemplateViewSchema.array(),
});

export type ViewTemplateView = z.infer<typeof viewTemplateViewSchema>;
export type ViewTemplate = z.infer<typeof viewTemplateSchema>;
