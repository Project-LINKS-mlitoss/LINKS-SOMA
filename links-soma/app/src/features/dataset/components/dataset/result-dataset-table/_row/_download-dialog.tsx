import {
  makeStyles,
  tokens,
  Dialog,
  Field,
  Radio,
  RadioGroup,
  DialogTrigger,
  Option,
  Spinner,
} from "@fluentui/react-components";
import { useState, useEffect } from "react";
import { ArrowDownloadRegular } from "@fluentui/react-icons";
import { useFetchReferenceDates } from "../../../../../../shared/hooks/use-fetch-reference-dates";
import { Dropdown } from "../../../../../../shared/components/ui/dropdown";
import { OUTPUT_FILE_TYPES } from "../../../../../../shared/config/file-types";
import { type SelectDataSetResult } from "../../../../../../db/schema";
import { DialogBody } from "../../../../../../shared/components/ui/dialog-body";
import { DialogTitle } from "../../../../../../shared/components/ui/dialog-title";
import { DialogContent } from "../../../../../../shared/components/ui/dialog-content";
import { DialogActions } from "../../../../../../shared/components/ui/dialog-actions";
import { DialogSurface } from "../../../../../../shared/components/ui/dialog-surface";
import { useDialogState } from "../../../../../../shared/hooks/use-dialog-state";
import { Button } from "../../../../../../shared/components/ui/button";
import { type ResultDataSetUnit } from "../types";
import { translateColumnToJapanese } from "../../../../../../shared/column-translation-utils";
import { OUTPUT_COORDINATES } from "../../../../../../shared/config/output-coordinates";

const useStyles = makeStyles({
  radioGroup: {
    marginTop: tokens.spacingVerticalM,
    marginLeft: "-8px",
  },
  dropdown: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    "& > label": {
      fontSize: "12px",
    },
  },
  loadingContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: tokens.spacingVerticalL,
  },
});

export function DownloadDialog({
  dataSetResultId,
  onSubmit,
}: {
  dataSetResultId: SelectDataSetResult["id"];
  onSubmit: () => void;
}): JSX.Element {
  const styles = useStyles();
  const { isOpen, setIsOpen } = useDialogState(false);
  const [selectedUnit, setSelectedUnit] =
    useState<ResultDataSetUnit>("building");
  const [selectedFileType, setSelectedFileType] = useState<string>(
    OUTPUT_FILE_TYPES[0].type,
  );
  const [selectedCoordinate, setSelectedCoordinate] = useState(
    OUTPUT_COORDINATES[0].code,
  );
  const [selectedReferenceDate, setSelectedReferenceDate] = useState<
    string | null
  >(null);

  // ダイアログが開いている時のみ参照日付を取得（遅延読み込み）
  const { data: referenceDates, isLoading: isLoadingReferenceDates } =
    useFetchReferenceDates({
      dataSetResultId: isOpen ? dataSetResultId : null,
    });

  // 参照日付が取得できたら初期値を設定
  useEffect(() => {
    if (referenceDates && referenceDates.length > 0 && !selectedReferenceDate) {
      setSelectedReferenceDate(referenceDates[0]);
    }
  }, [referenceDates, selectedReferenceDate]);

  // ダイアログを閉じたら選択状態をリセット
  useEffect(() => {
    if (!isOpen) {
      setSelectedReferenceDate(null);
    }
  }, [isOpen]);

  const handleDownload = async (): Promise<void> => {
    await window.ipcRenderer
      .invoke("exportData", {
        data: {
          parameterType: "export",
          data_set_results_id: dataSetResultId,
          target_unit: selectedUnit,
          output_file_type: selectedFileType,
          output_coordinate: selectedCoordinate,
          reference_date: selectedReferenceDate ?? undefined,
        },
      })
      .then(onSubmit);
  };

  return (
    <Dialog onOpenChange={(_, { open }) => setIsOpen(open)} open={isOpen}>
      <DialogTrigger disableButtonEnhancement>
        <Button
          appearance="subtle"
          aria-label="ダウンロード"
          icon={<ArrowDownloadRegular />}
          onClick={(e) => e.stopPropagation()}
        />
      </DialogTrigger>
      <DialogSurface onClick={(e) => e.stopPropagation()}>
        <DialogBody>
          <DialogTitle>データのダウンロード</DialogTitle>
          <DialogContent>
            {isLoadingReferenceDates ? (
              <div className={styles.loadingContainer}>
                <Spinner label="読み込み中..." size="small" />
              </div>
            ) : (
              <>
                <div>
                  <p>
                    空き家推定結果データは以下の2つのデータが含まれます。
                    どちらか選択してください。
                  </p>
                  <Field className={styles.radioGroup}>
                    <RadioGroup
                      defaultValue={selectedUnit}
                      onChange={(_, data) =>
                        setSelectedUnit(data.value as ResultDataSetUnit)
                      }
                    >
                      <Radio label="建物単位" value="building" />
                      <Radio label="地域単位" value="area" />
                    </RadioGroup>
                  </Field>
                </div>

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
                      data.optionValue &&
                      setSelectedCoordinate(data.optionValue)
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
                <div className={styles.dropdown}>
                  <label id="reference-date">
                    {translateColumnToJapanese("reference_date", "building")}
                  </label>
                  {selectedReferenceDate && referenceDates && (
                    <Dropdown
                      aria-labelledby="reference-date"
                      defaultSelectedOptions={[selectedReferenceDate]}
                      defaultValue={selectedReferenceDate}
                      onOptionSelect={(_, data) =>
                        setSelectedReferenceDate(data.optionValue || "")
                      }
                    >
                      {referenceDates.map((date) => (
                        <Option key={date} value={date}>
                          {date}
                        </Option>
                      ))}
                    </Dropdown>
                  )}
                </div>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button
              appearance="primary"
              disabled={isLoadingReferenceDates || !selectedReferenceDate}
              onClick={() => {
                void handleDownload();
                setIsOpen(false);
              }}
              size="medium"
            >
              ダウンロード準備を開始する
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
