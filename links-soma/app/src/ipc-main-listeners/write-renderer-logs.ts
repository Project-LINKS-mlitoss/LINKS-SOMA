import { mainProcessLogger } from "../shared/utils/main-process-logger";
import { type LogEntry } from "../shared/utils/renderer-logger";
import { type IpcMainListener } from ".";

export const writeRendererLogs = (async (
  _: unknown,
  { logs }: { logs: LogEntry[] },
): Promise<void> => {
  logs.forEach((log) => {
    const message = `[Renderer] ${log.message}`;
    const context = log.context
      ? ` | Context: ${JSON.stringify(log.context)}`
      : "";
    const fullMessage = `${message}${context}`;

    switch (log.level) {
      case "error":
        mainProcessLogger.error(fullMessage, log.error as Error);
        break;
      case "warn":
        mainProcessLogger.warn(fullMessage, log.error as Error);
        break;
      case "info":
        mainProcessLogger.info(fullMessage);
        break;
      case "debug":
        mainProcessLogger.debug(fullMessage);
        break;
      default:
        mainProcessLogger.info(fullMessage);
    }
  });
}) satisfies IpcMainListener;
