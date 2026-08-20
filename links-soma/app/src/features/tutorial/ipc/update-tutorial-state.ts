import { db } from "../../../db/client";
import { tutorial_state } from "../../../db/schema";
import { type TutorialResumeState } from "../../../shared/types/tutorial-resume";
import { mainProcessLogger } from "../../../shared/utils/main-process-logger";
import { type IpcMainListener } from "../../../ipc-main-listeners";
import { TUTORIAL_STATE_ID } from "./select-tutorial-state";

type UpdateTutorialStateParams = {
  phase: "idle" | "running" | "paused" | "done";
  stage: "normalization" | "model" | "evaluation" | "analysis" | null;
  modelMode: "build" | "generic" | null;
  draftJobId: number | null;
  modelJobId: number | null;
  evaluationJobId: number | null;
  resumeState: TutorialResumeState | null;
};

/**
 * ガイド進行状態（singleton）を upsert する。
 *
 * 1 行（id=1）に固定し、存在すれば更新・なければ挿入する。
 * ガイド状態の唯一の永続先（ADR-0024）。
 */
export const updateTutorialState = (async (
  _: unknown,
  {
    phase,
    stage,
    modelMode,
    draftJobId,
    modelJobId,
    evaluationJobId,
    resumeState,
  }: UpdateTutorialStateParams,
): Promise<void> => {
  const values = {
    phase,
    stage,
    model_mode: modelMode,
    draft_job_id: draftJobId,
    model_job_id: modelJobId,
    evaluation_job_id: evaluationJobId,
    resume_state: resumeState,
  };

  await db
    .insert(tutorial_state)
    .values({ id: TUTORIAL_STATE_ID, ...values })
    .onConflictDoUpdate({ target: tutorial_state.id, set: values })
    .run();

  mainProcessLogger.debug(
    `Updated tutorial state: phase=${phase}, stage=${stage}`,
  );
}) satisfies IpcMainListener;
