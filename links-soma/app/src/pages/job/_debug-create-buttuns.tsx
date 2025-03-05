import { Button, Caption1Strong } from "@fluentui/react-components";

export const DebugCreateButtons = (): JSX.Element => {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <Caption1Strong>処理疑似データ作成(debug)</Caption1Strong>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px" }}>
        <Button
          onClick={() => {
            window.ipcRenderer
              .invoke("_debugCreateJob", {
                job: "処理開始",
                jobType: "preprocess",
              })
              .catch(console.error);
          }}
          size="small"
        >
          名寄せ処理開始
        </Button>
        <Button
          onClick={() => {
            window.ipcRenderer
              .invoke("_debugCreateJob", {
                job: "処理完了",
                jobType: "preprocess",
              })
              .catch(console.error);
          }}
          size="small"
        >
          名寄せ処理完了
        </Button>
        <Button
          onClick={() => {
            window.ipcRenderer
              .invoke("_debugCreateJob", {
                job: "処理失敗",
                jobType: "preprocess",
              })
              .catch(console.error);
          }}
          size="small"
        >
          名寄せ処理失敗
        </Button>
        <Button
          onClick={() => {
            window.ipcRenderer
              .invoke("_debugCreateJob", {
                job: "処理開始",
                jobType: "ml",
              })
              .catch(console.error);
          }}
          size="small"
        >
          モデル構築開始
        </Button>
        <Button
          onClick={() => {
            window.ipcRenderer
              .invoke("_debugCreateJob", {
                job: "処理完了",
                jobType: "ml",
              })
              .catch(console.error);
          }}
          size="small"
        >
          モデル構築完了
        </Button>
        <Button
          onClick={() => {
            window.ipcRenderer
              .invoke("_debugCreateJob", {
                job: "処理失敗",
                jobType: "ml",
              })
              .catch(console.error);
          }}
          size="small"
        >
          モデル構築失敗
        </Button>
        <Button
          onClick={() => {
            window.ipcRenderer
              .invoke("_debugCreateJob", {
                job: "処理開始",
                jobType: "result",
                // parameters:,
              })
              .catch(console.error);
          }}
          size="small"
        >
          推定開始
        </Button>
        <Button
          onClick={() => {
            window.ipcRenderer
              .invoke("_debugCreateJob", {
                job: "処理完了",
                jobType: "result",
              })
              .catch(console.error);
          }}
          size="small"
        >
          推定完了
        </Button>
        <Button
          onClick={() => {
            window.ipcRenderer
              .invoke("_debugCreateJob", {
                job: "処理失敗",
                jobType: "result",
              })
              .catch(console.error);
          }}
          size="small"
        >
          推定失敗
        </Button>
        <Button
          onClick={() => {
            window.ipcRenderer
              .invoke("_debugCreateJob", {
                job: "処理開始",
                jobType: "export",
                // parameters:,
              })
              .catch(console.error);
          }}
          size="small"
        >
          推定結果ダウンロード準備開始
        </Button>
        <Button
          onClick={() => {
            window.ipcRenderer
              .invoke("_debugCreateJob", {
                job: "処理完了",
                jobType: "export",
              })
              .catch(console.error);
          }}
          size="small"
        >
          推定結果ダウンロード準備完了
        </Button>
        <Button
          onClick={() => {
            window.ipcRenderer
              .invoke("_debugCreateJob", {
                job: "処理失敗",
                jobType: "export",
              })
              .catch(console.error);
          }}
          size="small"
        >
          推定結果ダウンロード準備失敗
        </Button>
      </div>
    </div>
  );
};
