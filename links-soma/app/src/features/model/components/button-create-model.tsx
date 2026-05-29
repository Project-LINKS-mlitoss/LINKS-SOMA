import { ArrowUploadFilled } from "@fluentui/react-icons";
import { tokens } from "@fluentui/react-components";
import { type ChangeEvent, useRef } from "react";
import { saveModelFile } from "../../../shared/utils/save-model-file";
import { rendererLogger } from "../../../shared/utils/renderer-logger";
import { useFetchModelFiles } from "../hooks/use-fetch-model-files";
import { Button } from "../../../shared/components/ui/button";

export const ButtonCreateModel = (): JSX.Element => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutate } = useFetchModelFiles();

  const handleUpload = async (
    e: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file?.name.endsWith(".zip")) {
      alert(
        "ファイル形式が正しくありません。\nzipファイルを選択してください。",
      );
      return;
    } else {
      await saveModelFile(file)
        .then(() => {
          void mutate();
        })
        .catch((error) => {
          rendererLogger.error("Failed to save model file", {
            error,
            fileName: file.name,
          });
        });
    }
    e.target.value = ""; // ファイル選択をリセットする
  };

  return (
    <>
      <Button
        icon={
          <ArrowUploadFilled
            color={tokens.colorNeutralForeground1}
            fontSize={tokens.fontSizeBase400}
          />
        }
        onClick={() => {
          // OSのファイル選択ダイアログを開く
          fileInputRef.current?.click();
        }}
        size="small"
      >
        学習済モデルをアップロード
      </Button>
      <input
        ref={fileInputRef}
        onChange={handleUpload}
        style={{ display: "none" }}
        type="file"
      />
    </>
  );
};
