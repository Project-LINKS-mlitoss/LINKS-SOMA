import { Spinner } from "@fluentui/react-components";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { useFetchDataSetResults } from "../../hooks/use-fetch-data-set-results";

export const DebugCreateDatasets = (): JSX.Element => {
  const { data: dataSetResults, mutate } = useFetchDataSetResults();

  const numberOfDataSets = dataSetResults?.length || 0;
  const [isLoading, setIsLoading] = useState(false);
  const startCreating = (): void => {
    console.info("Start creating dummy data set results!");
    setIsLoading(true);
  };
  const finishCreating = async (): Promise<void> => {
    console.info("Finish creating dummy data set results🎉");
    await mutate();
    setIsLoading(false);
  };

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        background: "#eee",
        padding: "8px 4px",
        borderRadius: 4,
      }}
    >
      <div style={{ padding: 4 }}>
        <h4>開発用のデータセットを追加</h4>
      </div>
      <Button
        disabled={isLoading}
        onClick={async () => {
          startCreating();
          await window.ipcRenderer
            .invoke("createDummyDataSetResults", {
              full: true,
              title: `分析結果(32万件)-${numberOfDataSets + 1}`,
            })
            .then(finishCreating);
        }}
        size="small"
      >
        32万件のデータセットを追加(最大)
      </Button>
      <Button
        disabled={isLoading}
        onClick={async () => {
          startCreating();
          await window.ipcRenderer
            .invoke("createDummyDataSetResults", {
              full: false,
              title: `分析結果(3.2万件)-${numberOfDataSets + 1}`,
            })
            .then(finishCreating);
        }}
        size="small"
      >
        3.2万件のデータセットを追加
      </Button>
      <Button
        disabled={isLoading}
        onClick={async () => {
          startCreating();
          await window.ipcRenderer
            .invoke("createDataSetResults", {
              title: `分析結果(軽量版)-${numberOfDataSets + 1}`,
            })
            .then(finishCreating);
        }}
        size="small"
      >
        軽量版のデータセットを追加
      </Button>
      {isLoading ? (
        <div>
          <Spinner />
          データセットをインポート中...
          <br />
          読み込みが終わるまでお待ちください
        </div>
      ) : null}
    </div>
  );
};
