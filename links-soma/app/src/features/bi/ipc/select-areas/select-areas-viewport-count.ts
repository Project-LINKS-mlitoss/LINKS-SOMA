import { and, count } from "drizzle-orm";
import { data_set_detail_areas } from "../../../../db/schema";
import { db } from "../../../../db/client";
import { mainProcessLogger } from "../../../../shared/utils/main-process-logger";
import { type IpcMainListener } from "../../../../ipc-main-listeners";
import { type AreaQueryParamsWithViewport } from "../../types";
import { conditionsBuilder } from "./_shared";

export const selectAreasViewportCount = ((
  _: unknown,
  params: AreaQueryParamsWithViewport,
): number => {
  try {
    const conditions = conditionsBuilder(params);

    // 地域データは緯度・経度フィールドがないため、
    // WKT geometryによる精密フィルタリングのみを使用

    const result = db
      .select({ count: count() })
      .from(data_set_detail_areas)
      .where(and(...conditions))
      .get();

    return result?.count ?? 0;
  } catch (error) {
    mainProcessLogger.error(
      "Error counting area viewport data",
      error as Error,
    );
    return 0;
  }
}) satisfies IpcMainListener;
