import { Dismiss24Regular } from "@fluentui/react-icons";
import {
  Dialog,
  DialogTrigger,
  makeStyles,
  tokens,
  Option,
} from "@fluentui/react-components";
import { useState } from "react";
import {
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogActions,
  Button,
  DialogContent,
  Dropdown,
} from "../../../../shared/components/ui";
import { type useDialogState } from "../../../../shared/hooks/use-dialog-state";
import { OUTPUT_FILE_TYPES } from "../../../../shared/config/file-types";
import { OUTPUT_COORDINATES } from "../../../../shared/config/output-coordinates";

const useStyles = makeStyles({
  dialogContent: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  dropdown: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    "& > label": {
      fontSize: "12px",
    },
  },
});

type Props = {
  onSubmit: (fileType: string, coordinate: string) => void;
  /** ダイアログの開閉状態を制御 */
  dialogState: ReturnType<typeof useDialogState>;
};

export function DownloadDialog({ onSubmit, dialogState }: Props): JSX.Element {
  const styles = useStyles();
  const { isOpen, setIsOpen } = dialogState;
  const [selectedFileType, setSelectedFileType] = useState<string>(
    OUTPUT_FILE_TYPES[0].type,
  );
  const [selectedCoordinate, setSelectedCoordinate] = useState(
    OUTPUT_COORDINATES[0].code,
  );

  return (
    <Dialog onOpenChange={(_, { open }) => setIsOpen(open)} open={isOpen}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button
                  appearance="subtle"
                  aria-label="close"
                  icon={
                    <Dismiss24Regular
                      color={tokens.colorNeutralForeground1}
                      strokeWidth={2}
                    />
                  }
                />
              </DialogTrigger>
            }
          >
            形式を選んでダウンロード
          </DialogTitle>
          <DialogContent className={styles.dialogContent}>
            <div className={styles.dropdown}>
              <label id="output-file-type">出力ファイル形式</label>
              <Dropdown
                aria-labelledby="output-file-type"
                defaultSelectedOptions={[OUTPUT_FILE_TYPES[0].type]}
                defaultValue={OUTPUT_FILE_TYPES[0].name}
                onOptionSelect={(_, data) =>
                  data.optionValue && setSelectedFileType(data.optionValue)
                }
              >
                {OUTPUT_FILE_TYPES.map((option) => (
                  <Option
                    key={option.type}
                    text={option.name}
                    value={option.type}
                  >
                    {option.name}
                  </Option>
                ))}
              </Dropdown>
            </div>
            <div className={styles.dropdown}>
              <label id="output-coordinate">出力座標系</label>
              <Dropdown
                aria-labelledby="output-coordinate"
                defaultSelectedOptions={[OUTPUT_COORDINATES[0].code]}
                defaultValue={OUTPUT_COORDINATES[0].name}
                onOptionSelect={(_, data) =>
                  data.optionValue && setSelectedCoordinate(data.optionValue)
                }
              >
                {OUTPUT_COORDINATES.map((option) => (
                  <Option
                    key={option.code}
                    text={option.name}
                    value={option.code}
                  >
                    {option.name}
                  </Option>
                ))}
              </Dropdown>
            </div>
          </DialogContent>
          <DialogActions>
            <Button
              appearance="primary"
              onClick={() => {
                onSubmit(selectedFileType, selectedCoordinate);
                setIsOpen(false);
              }}
            >
              ダウンロード準備を開始する
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
