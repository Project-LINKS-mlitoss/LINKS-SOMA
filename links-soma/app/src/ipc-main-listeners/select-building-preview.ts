import { eq } from "drizzle-orm";
import { db } from "../utils/db";
import { data_set_detail_buildings } from "../schema";
import { type IpcMainListener } from ".";

export interface PreviewData {
  normalized_address: string;
  water_supply_number: string;
  area_group: string;
  predicted_probability: number;
}

type SelectBuildingPreviewResponse = PreviewData[];

export const selectBuildingPreview = (async (
  _: unknown,
  { dataSetResultId }: { dataSetResultId: number },
): Promise<SelectBuildingPreviewResponse> => {
  const rows = await db
    .select({
      normalized_address: data_set_detail_buildings.normalized_address,
      water_supply_number: data_set_detail_buildings.water_supply_number,
      area_group: data_set_detail_buildings.area_group,
      predicted_probability: data_set_detail_buildings.predicted_probability,
    })
    .from(data_set_detail_buildings)
    .where(eq(data_set_detail_buildings.data_set_result_id, dataSetResultId))
    .all();

  const previewData: PreviewData[] = rows.map((row) => ({
    normalized_address: row.normalized_address ?? "",
    water_supply_number: row.water_supply_number ?? "",
    area_group: row.area_group ?? "",
    predicted_probability: row.predicted_probability ?? 0,
  }));

  return previewData;
}) satisfies IpcMainListener;
