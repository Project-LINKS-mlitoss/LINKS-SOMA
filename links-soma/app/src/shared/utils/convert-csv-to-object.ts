import { createReadStream } from "fs";
import { parse } from "csv-parse";
import { mainProcessLogger } from "./main-process-logger";

interface Result {
  meta: {
    fields: string[];
    rowCount: number;
  };
}

export async function convertCsvToObject(
  filePath: string,
  onData: (record: Record<string, string>) => Promise<void>,
): Promise<Result> {
  try {
    return new Promise((resolve, reject) => {
      let headers: string[] = [];
      let rowCount = 0;

      const parser = parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      });

      createReadStream(filePath, { encoding: "utf8" })
        .pipe(parser)
        .on("headers", (headerRow) => {
          headers = headerRow;
        })
        .on("data", (record) => {
          parser.pause();
          onData(record)
            .then(() => {
              rowCount++;
              parser.resume();
            })
            .catch(reject);
        })
        .on("end", () => {
          resolve({
            meta: {
              fields: headers,
              rowCount,
            },
          });
        })
        .on("error", (err) => {
          reject(new Error(`CSVのパースに失敗しました: ${err.message}`));
        });
    });
  } catch (error) {
    mainProcessLogger.error(
      `CSV processing error - filePath: ${filePath}`,
      error as Error,
    );
    throw error;
  }
}
