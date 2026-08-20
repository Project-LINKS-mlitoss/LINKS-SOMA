import { desc } from "drizzle-orm";
import { view_templates } from "../../../db/schema";
import { db } from "../../../db/client";
import { SYSTEM_VIEW_PRESETS } from "../config/view-presets";
import { type ViewTemplateView } from "../types";
import { type IpcMainListener } from "../../../ipc-main-listeners";

/**
 * 一覧表示用の統一形。id はソース込みで `system:<key>` / `user:<dbId>`。
 * UI は kind で「SOMA 提供」と「自分が保存」を区別できる。
 */
export type ViewTemplateListItem = {
  id: string;
  kind: "system" | "user";
  name: string;
  /** 業務的な意図（memo）。system プリセット・user テンプレ（任意入力）の双方が保持しうる */
  description?: string;
  views: ViewTemplateView[];
};

/**
 * システムプリセット（コード定数）+ ユーザーテンプレート（DB）をマージして返す。
 * FR021「プリセット適用」「保存テンプレから再追加」の前段一覧。
 */
export const selectViewTemplates = (async (): Promise<
  ViewTemplateListItem[]
> => {
  const system: ViewTemplateListItem[] = SYSTEM_VIEW_PRESETS.map((preset) => ({
    id: `system:${preset.key}`,
    kind: "system",
    name: preset.name,
    description: preset.description,
    views: preset.views,
  }));

  // ユーザーテンプレートは更新順（新しいものが上）。直近に編集したものから探せる。
  const users = await db
    .select()
    .from(view_templates)
    .orderBy(desc(view_templates.updated_at));
  const user: ViewTemplateListItem[] = users.map((template) => ({
    id: `user:${template.id}`,
    kind: "user",
    name: template.name,
    description: template.description ?? undefined,
    views: template.views,
  }));

  // 並び順は「自分が保存（更新順）→ SOMA 提供」。直近に作ったものを最優先で見せる。
  return [...user, ...system];
}) satisfies IpcMainListener;
