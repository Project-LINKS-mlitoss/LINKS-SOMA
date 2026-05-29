import { and, eq, gt, or } from "drizzle-orm";
import {
  data_set_detail_areas,
  type SelectDataSetDetailArea,
} from "../../../db/schema";
import { db } from "../../../db/client";
import { type FilterCondition } from "../types";
import { mainProcessLogger } from "../../../shared/utils/main-process-logger";
import { filterQueryBuilder } from "../services";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const selectAreasInBatches = ((
  _: unknown,
  {
    dataSetResultId,
    referenceDate,
    batchSize,
    lastId,
    areas,
    filterConditions,
  }: {
    dataSetResultId: number;
    batchSize: number;
    referenceDate?: string;
    lastId?: number;
    areas?: string[];
    filterConditions?: FilterCondition[];
  },
): SelectDataSetDetailArea[] | null => {
  try {
    const result = db
      .select()
      .from(data_set_detail_areas)
      .where(
        and(
          eq(data_set_detail_areas.data_set_result_id, dataSetResultId),
          referenceDate
            ? eq(data_set_detail_areas.reference_date, referenceDate)
            : undefined,
          lastId ? gt(data_set_detail_areas.id, lastId) : undefined,
          areas && areas.length > 0
            ? or(
                ...areas.map((area) =>
                  eq(data_set_detail_areas.area_group, area),
                ),
              )
            : undefined,
          ...filterQueryBuilder({ conditions: filterConditions ?? [] }),
        ),
      )
      .limit(batchSize)
      .all();
    return result;
  } catch (error) {
    mainProcessLogger.error(
      `Error fetching areas in batches - dataSetResultId: ${dataSetResultId}, referenceDate: ${referenceDate}, batchSize: ${batchSize}, lastId: ${lastId}, areasCount: ${areas?.length ?? 0}`,
      error as Error,
    );
    return null;
  }
}) satisfies IpcMainListener;
