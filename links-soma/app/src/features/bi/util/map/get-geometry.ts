import { type View } from "../../types/models/view";

export type GetGeometryParams = {
  unit: View["unit"];
  dataSetResultId: View["dataSetResultId"];
  selectedDate: string | undefined;
  areas: string[] | undefined;
};

/**
 * 初期表示用に有効なジオメトリを取得する
 * ジオメトリがnullのレコードはスキップし、有効なジオメトリを持つ最初のレコードを返す
 */
export const getGeometry = async ({
  unit,
  dataSetResultId,
  selectedDate,
  areas,
}: GetGeometryParams): Promise<string | undefined> => {
  switch (unit) {
    case "building": {
      // geometryNotNull: true で有効なジオメトリを持つレコードのみを取得
      const result = await window.ipcRenderer.invoke("selectBuildingsChunk", {
        dataSetResultId,
        referenceDate: selectedDate,
        batchSize: 1,
        areas,
        filterConditions: [],
        geometryNotNull: true,
      });
      const properties = result?.[0]?.properties;

      // null を undefined に変換（関数の戻り値型に合わせる）
      return properties?.bldg_geometry ?? undefined;
    }
    case "area": {
      const result = await window.ipcRenderer.invoke("selectAreasInBatches", {
        dataSetResultId,
        referenceDate: selectedDate,
        batchSize: 1,
        areas,
      });
      return result?.[0]?.geometry;
    }
    default: {
      const exhaustiveCheck: never = unit;
      throw new Error(`Unhandled type: ${exhaustiveCheck}`);
    }
  }
};
