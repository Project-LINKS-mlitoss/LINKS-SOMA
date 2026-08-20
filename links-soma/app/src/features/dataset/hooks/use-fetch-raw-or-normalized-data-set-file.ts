import useSWR, { type SWRResponse } from "swr";
import {
  type SelectNormalizedDataSet,
  type SelectRawDataSet,
} from "../../../db/schema";
import { toDisplayHeaderLine } from "../../../shared/utils/normalized-csv-header";

export type RawOrNormalized = "raw" | "normalized";

type Params = {
  id: number;
  type: RawOrNormalized;
  page: number;
  limitPerPage: number;
};

type Response = Record<string, string>[] | undefined;

const fetcher = async ([id, type, page, limitPerPage]: [
  Params["id"],
  Params["type"],
  Params["page"],
  Params["limitPerPage"],
  string,
]): Promise<Response> => {
  let dataSet: SelectRawDataSet | SelectNormalizedDataSet | undefined;
  switch (type) {
    case "raw": {
      dataSet = await window.ipcRenderer.invoke("selectRawDataset", {
        id,
      });
      break;
    }
    case "normalized": {
      dataSet = await window.ipcRenderer.invoke("selectNormalizedDataSet", {
        id,
      });
      break;
    }
    default: {
      const exhaustiveCheck: never = type;
      throw new Error(`Unhandled type: ${exhaustiveCheck}`);
    }
  }

  if (!dataSet) return undefined;

  const file = await window.ipcRenderer.invoke("readDatasetFile", {
    fileName: dataSet.file_path,
  });

  const uint8Array = new Uint8Array(file);
  const csvString = uint8ArrayToString(uint8Array);
  const rows = csvString.trim().split("\n");
  // 名寄せ済みデータは一部の列名がディスク上で英語のまま残る。表示だけ読み替える（ADR-0029）
  const headerLine =
    type === "normalized" ? toDisplayHeaderLine(rows[0]) : rows[0];
  const headers = headerLine.split(",").map((header) => header.trim());

  const totalItems = rows.length - 1; // ヘッダーを除いた行数
  const totalPages = Math.ceil(totalItems / limitPerPage);
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * limitPerPage + 1; // ヘッダー行の分を加算
  const endIndex = Math.min(startIndex + limitPerPage, rows.length);

  const paginatedRecords = rows.slice(startIndex, endIndex).map((row) => {
    const values = row.split(",").map((value) => value.trim());
    const record: Record<string, string> = {};

    headers.forEach((header, index) => {
      record[header] = values[index] || ""; // 値が無い場合は空文字を設定
    });

    return record;
  });

  return paginatedRecords;
};

export const useFetchRawOrNormalizedDataSetFile = ({
  id,
  type,
  page = 1,
  limitPerPage = 20,
}: Params): SWRResponse<Response> => {
  const swr = useSWR(
    [id, type, page, limitPerPage, useFetchRawOrNormalizedDataSetFile.name],
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );
  return swr;
};

function uint8ArrayToString(uint8Array: Uint8Array): string {
  return new TextDecoder("utf-8").decode(uint8Array);
}
