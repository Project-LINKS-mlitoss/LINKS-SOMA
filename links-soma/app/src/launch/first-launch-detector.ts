import { db } from "../db/client";
import { model_files } from "../db/schema";
import { mainProcessLogger } from "../shared/utils/main-process-logger";

export async function isFirstLaunch(): Promise<boolean> {
  try {
    const existingModels = await db.select().from(model_files).limit(1);
    const isFirst = existingModels.length === 0;

    mainProcessLogger.info(
      `First launch check completed: ${isFirst ? "first launch" : "subsequent launch"} (existing models: ${existingModels.length})`,
    );

    return isFirst;
  } catch (error) {
    mainProcessLogger.error(
      "Failed to check if this is first launch",
      error as Error,
    );
    return false;
  }
}
