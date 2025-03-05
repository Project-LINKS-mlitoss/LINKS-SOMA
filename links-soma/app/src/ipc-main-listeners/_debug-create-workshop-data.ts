import { getFilePathInDummyData } from "../utils/get-file-path-in-dummy-data";
import { convertCsvToObject } from "../utils/convert-csv-to-object";
import { db } from "../utils/db";
import {
  data_set_detail_areas,
  data_set_detail_buildings,
  data_set_results,
  type InsertDataSetDetailArea,
  type InsertDataSetDetailBuilding,
} from "../schema";
import { type IpcMainListener } from ".";

export const _debugCreateWorkshopData = (async (
  _: unknown,
  { title }: { title: string },
) => {
  const { dataSetResultsId } = await db
    .insert(data_set_results)
    .values({ title })
    .returning({ dataSetResultsId: data_set_results.id })
    .get();

  // Process buildings
  await convertCsvToObject(
    getFilePathInDummyData("D902_workshop.csv"),
    // idや作成日時はinsertしないようにする
    async ({ _id, _created_at, _updated_at, ...rest }) => {
      await db
        .insert(data_set_detail_buildings)
        .values({
          ...(rest as unknown as InsertDataSetDetailBuilding),
          data_set_result_id: dataSetResultsId,
        })
        .execute();
    },
  );

  // Process areas
  await convertCsvToObject(
    getFilePathInDummyData("D903_workshop.csv"),
    // idや作成日時はinsertしないようにする
    async ({ _id, _created_at, _updated_at, ...rest }) => {
      await db
        .insert(data_set_detail_areas)
        .values({
          ...(rest as unknown as InsertDataSetDetailArea),
          data_set_result_id: dataSetResultsId,
        })
        .execute();
    },
  );
}) satisfies IpcMainListener;
