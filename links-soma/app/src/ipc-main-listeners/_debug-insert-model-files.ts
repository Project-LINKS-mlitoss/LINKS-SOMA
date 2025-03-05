import { model_files } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

export const _debugInsertModelFiles = (async (): Promise<void> => {
  db.insert(model_files)
    .values({
      file_name: "test",
      file_path: "path/to/test.csv",
      note: "このモデルはChatGPT、OpenAIによって開発されたGPT-4アーキテクチャに基づく大規模な言語モデルです。",
    })
    .returning({ insertedId: model_files.id })
    .get();
}) satisfies IpcMainListener;
