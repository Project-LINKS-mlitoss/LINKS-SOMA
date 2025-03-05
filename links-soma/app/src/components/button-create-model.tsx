import { AddFilled } from "@fluentui/react-icons";
import {
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  tokens,
} from "@fluentui/react-components";
import { useNavigate } from "react-router-dom";
import { type ChangeEvent, useRef } from "react";
import { saveModelFile } from "../utils/save-model-file";
import { useFetchModelFiles } from "../hooks/use-fetch-model-files";
import { Button } from "./ui/button";

export const ButtonCreateModel = (): JSX.Element => {
  const navigator = useNavigate();
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
        .catch(console.error);
    }
    e.target.value = ""; // ファイル選択をリセットする
  };

  return (
    <>
      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <Button
            icon={
              <AddFilled
                color={tokens.colorNeutralForeground1}
                fontSize={tokens.fontSizeBase400}
                strokeWidth={2}
              />
            }
            size="small"
          >
            モデル構築を始める
          </Button>
        </MenuTrigger>

        <MenuPopover>
          <MenuList>
            <MenuItem
              onClick={() => {
                navigator("/normalization/create");
              }}
            >
              名寄せ処理から始める
            </MenuItem>
            <MenuItem
              onClick={() => {
                navigator("/model/create");
              }}
            >
              名寄せ処理済データから始める
            </MenuItem>
            <MenuItem
              onClick={() => {
                // OSのファイル選択ダイアログを開く
                fileInputRef.current?.click();
              }}
            >
              学習済モデルをアップロード
            </MenuItem>
          </MenuList>
        </MenuPopover>
      </Menu>
      <input
        ref={fileInputRef}
        onChange={handleUpload}
        style={{ display: "none" }}
        type="file"
      />
    </>
  );
};
