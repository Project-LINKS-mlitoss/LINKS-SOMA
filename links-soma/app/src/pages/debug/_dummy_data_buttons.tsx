import { Button } from "@fluentui/react-components";
import {
  type InsertNormalizedDataSet,
  type InsertRawDataSet,
} from "../../schema";
import { useFetchRawDatasets } from "../../hooks/use-fetch-raw-datasets";
import { useFetchNormalizedDatasets } from "../../hooks/use-fetch-normalized-datasets";
import { useFetchDataSetResults } from "../../hooks/use-fetch-data-set-results";

export function DummyDataButtons(): JSX.Element {
  const { mutate: mutateRaw } = useFetchRawDatasets();
  const { mutate: mutateNormalized } = useFetchNormalizedDatasets();
  const { mutate: mutateResult } = useFetchDataSetResults();

  async function handleAddRawAndNormalized(): Promise<void> {
    for (const seed of _dummyRawDataSets) {
      await window.ipcRenderer.invoke("insertRawDatasets", seed);
    }
    for (const normalized of _dummyNormalizedDataSets) {
      await window.ipcRenderer.invoke("insertNormalizedDatasets", normalized);
    }
    await mutateRaw();
    await mutateNormalized();
  }

  const handleAddResult = async (): Promise<void> => {
    await window.ipcRenderer.invoke("_debugCreateWorkshopData", {
      title: `推定結果データ`,
    });
    await mutateResult();
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
      }}
    >
      <Button onClick={handleAddRawAndNormalized} size="small">
        シード・正規化済みデータを追加する
      </Button>
      <Button onClick={handleAddResult} size="small">
        推定結果データを追加する
      </Button>
    </div>
  );
}

const _dummyRawDataSets: InsertRawDataSet[] = [
  {
    file_name: "シードデータ",
    file_path: "dummy-data.csv",
  },
  {
    file_name: "水道メーター1.shp",
    file_path: "dummy-data.csv",
  },
  {
    file_name: "名寄せ処理住民台帳1.csv",
    file_path: "dummy-data.csv",
  },
  {
    file_name: "名寄せ処理住民台帳2.csv",
    file_path: "dummy-data.csv",
  },
  {
    file_name: "名寄せ処理住民台帳3.csv",
    file_path: "dummy-data.csv",
  },
  {
    file_name: "水道メーター2.shp",
    file_path: "dummy-data.csv",
  },
];

const _dummyNormalizedDataSets: InsertNormalizedDataSet[] = [
  {
    file_name: "正規化済みデータ",
    file_path: "dummy-data.csv",
  },
  {
    file_name: "水道メーター1.shp",
    file_path: "dummy-data.csv",
  },
  {
    file_name: "名寄せ処理住民台帳1.csv",
    file_path: "dummy-data.csv",
  },
  {
    file_name: "名寄せ処理住民台帳2.csv",
    file_path: "dummy-data.csv",
  },
  {
    file_name: "名寄せ処理住民台帳3.csv",
    file_path: "dummy-data.csv",
  },
  {
    file_name: "水道メーター2.shp",
    file_path: "dummy-data.csv",
  },
];
