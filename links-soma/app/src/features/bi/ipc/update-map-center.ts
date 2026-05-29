import { eq } from "drizzle-orm";
import { result_views } from "../../../db/schema";
import { db } from "../../../db/client";
import { type MapCenter } from "../types";
import { type IpcMainListener } from "../../../ipc-main-listeners";

type Params = {
  resultViewId: number;
  mapCenter: MapCenter;
};
export const updateMapCenter = (async (
  _: unknown,
  { mapCenter, resultViewId }: Params,
): Promise<void> => {
  const res = db
    .select({
      parameters: result_views.parameters,
    })
    .from(result_views)
    .where(eq(result_views.id, resultViewId))
    .get();

  if (!res) {
    throw new Error(`Result view with ID ${resultViewId} not found.`);
  }

  const currentParameters = res.parameters.filter(
    (param) => param.key !== "map_center",
  );

  await db
    .update(result_views)
    .set({ parameters: [...currentParameters, mapCenter] })
    .where(eq(result_views.id, resultViewId));
}) satisfies IpcMainListener;
