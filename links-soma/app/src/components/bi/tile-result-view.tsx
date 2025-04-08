import {
  DeleteRegular,
  Dismiss24Regular,
  ArrowDownloadRegular,
} from "@fluentui/react-icons";
import {
  Card,
  CardHeader,
  type CardProps,
  Dialog,
  DialogTrigger,
  makeStyles,
  mergeClasses,
  Subtitle2,
  tokens,
  Option,
} from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type SelectResultView } from "../../schema";
import { THEME_COLORS } from "../../config/theme-colors";
import { useFetchResultViews } from "../../hooks/use-fetch-result-views";
import { DialogSurface } from "../ui/dialog-surface";
import { DialogBody } from "../ui/dialog-body";
import { DialogTitle } from "../ui/dialog-title";
import { DialogActions } from "../ui/dialog-actions";
import { Button } from "../ui/button";
import { DialogContent } from "../ui/dialog-content";
import { Dropdown } from "../ui/dropdown";
import { useFetchReferenceDates } from "../../hooks/use-fetch-reference-dates";
import { useDialogState } from "../../hooks/use-dialog-state";
import { DialogExportMessage } from "../dialog-export-message";
import { OUTPUT_FILE_TYPES } from "../../config/file-types";
import { type View } from "../../bi-modules/interfaces/view";
import { ROUTES } from "../../routes";
import { useWorkbookIdsSearchQuery } from "../../bi-modules/hooks/use-workbook-ids-search-query";
import { TileViewStyle } from "./tile-view-style";

type Props = {
  resultView: SelectResultView;
  className?: string;
  focusable?: boolean;
  cardProps?: CardProps;
};

const useStyles = makeStyles({
  selected: {
    border: `2px solid ${THEME_COLORS.primary}`,
  },
  cardSurface: {
    border: `2px solid transparent`,
    transition: "border,background-color 0.2s",
    boxShadow: tokens.shadow16,
    // border分を引いている
    padding: `calc(${tokens.spacingHorizontalXXL} - 2px) calc(${tokens.spacingVerticalXXL} - 2px)`,
    gap: tokens.spacingVerticalXL,
  },
  cardHeaderActions: {
    display: "flex",
    gap: tokens.spacingHorizontalM,
  },
  cardHeaderSubtle: {
    padding: `${tokens.spacingHorizontalXXS} ${tokens.spacingVerticalXXS}`,
    border: "none",
    minWidth: "24px",
    minHeight: "24px",
  },
  title: {
    minHeight: "22px",
  },
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

export const TileResultView = ({
  resultView,
  className,
  focusable,
}: Props): JSX.Element => {
  const styles = useStyles();
  const navigate = useNavigate();

  const { workbookId, viewId } = useWorkbookIdsSearchQuery();

  const exportMessageDialogState = useDialogState();

  const { mutate } = useFetchResultViews({
    sheetId: resultView.sheet_id,
  });

  const handleClick = (): void => {
    navigate(
      ROUTES.ANALYSIS.WORKBOOK_EDIT({
        id: workbookId || "",
        queryParams: {
          sheetId: resultView.sheet_id,
          viewId: resultView.id,
        },
      }),
    );
  };

  const handleDownload = async (
    fileType: string,
    coordinate: string,
    reference_date: string | undefined,
  ): Promise<void> => {
    if (!resultView.data_set_result_id || !resultView.unit || !reference_date)
      return;
    await window.ipcRenderer
      .invoke("exportData", {
        data: {
          parameterType: "export",
          output_file_type: fileType,
          output_coordinate: coordinate,
          data_set_results_id: resultView.data_set_result_id,
          target_unit: resultView.unit,
          reference_date,
        },
      })
      .then(() => {
        exportMessageDialogState.setIsOpen(true);
      });
  };

  const handleDelete = async (): Promise<void> => {
    if (!resultView.sheet_id) return;
    await window.ipcRenderer.invoke("deleteResultView", {
      resultViewId: resultView.id,
      sheetId: resultView.sheet_id,
    });
    await mutate();
  };

  const selected = String(resultView.id) === viewId;
  const isInvalidParameters =
    !resultView.style ||
    !resultView.unit ||
    (resultView.style !== "map" && !resultView.parameters);

  return (
    <Card
      className={mergeClasses(
        styles.cardSurface,
        selected && styles.selected,
        className,
      )}
      onClick={focusable ? handleClick : undefined}
    >
      <CardHeader
        action={
          <div className={styles.cardHeaderActions}>
            {resultView.data_set_result_id && (
              <DownloadDialog
                dataSetResultId={resultView.data_set_result_id}
                onSubmit={handleDownload}
              />
            )}
            <DeleteDialog onSubmit={handleDelete} />
          </div>
        }
        header={
          <Subtitle2 className={styles.title}>
            {resultView.title ?? ""}
          </Subtitle2>
        }
      />
      {isInvalidParameters ? (
        <div>パラメーターの値を正しく設定してください</div>
      ) : resultView.unit && resultView.data_set_result_id ? (
        <TileViewStyle
          view={
            {
              id: resultView.id,
              dataSetResultId: resultView.data_set_result_id,
              style: resultView.style,
              unit: resultView.unit,
              title: resultView.title,
              parameters: resultView.parameters,
            } as View /** @todo parametersの定義が一致していないため仮 */
          }
        />
      ) : (
        <div>データセットが選択されていません</div>
      )}
      <DialogExportMessage dialogState={exportMessageDialogState} />
    </Card>
  );
};

function DownloadDialog({
  dataSetResultId,
  onSubmit,
}: {
  dataSetResultId: number;
  onSubmit: (
    fileType: string,
    coordinate: string,
    reference_date: string | undefined,
  ) => void;
}): JSX.Element {
  const styles = useStyles();
  const { isOpen, setIsOpen } = useDialogState();
  const [selectedFileType, setSelectedFileType] = useState(
    OUTPUT_FILE_TYPES[0].type,
  );
  const [selectedCoordinate, setSelectedCoordinate] = useState(
    OUTPUT_COORDINATES[0].code,
  );

  const { data: referenceDates } = useFetchReferenceDates({
    dataSetResultId,
  });

  const [selectedReferenceDate, setSelectedReferenceDate] = useState<
    string | undefined
  >(referenceDates?.[0]);

  useEffect(
    function fetchReferenceDatesEffect() {
      if (!referenceDates) return;
      setSelectedReferenceDate(
        (prevSelectedDate) => prevSelectedDate || referenceDates[0],
      );
    },
    [referenceDates],
  );

  return (
    <Dialog onOpenChange={(_, { open }) => setIsOpen(open)} open={isOpen}>
      <DialogTrigger disableButtonEnhancement>
        <Button
          appearance="subtle"
          className={styles.cardHeaderSubtle}
          icon={<ArrowDownloadRegular />}
        />
      </DialogTrigger>
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
            <div className={styles.dropdown}>
              <label id="reference-date">推定日</label>
              {selectedReferenceDate && (
                <Dropdown
                  aria-labelledby="reference-date"
                  defaultSelectedOptions={[selectedReferenceDate]}
                  defaultValue={selectedReferenceDate}
                  onOptionSelect={(_, data) =>
                    setSelectedReferenceDate(data.optionValue || "")
                  }
                >
                  {referenceDates?.map((date) => (
                    <Option key={date} value={date}>
                      {date}
                    </Option>
                  ))}
                </Dropdown>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button
              appearance="primary"
              onClick={() => {
                onSubmit(
                  selectedFileType,
                  selectedCoordinate,
                  selectedReferenceDate,
                );
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

function DeleteDialog({ onSubmit }: { onSubmit: () => void }): JSX.Element {
  const styles = useStyles();

  return (
    <Dialog>
      <DialogTrigger disableButtonEnhancement>
        <Button
          appearance="subtle"
          className={styles.cardHeaderSubtle}
          icon={<DeleteRegular />}
        />
      </DialogTrigger>
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
            ビューを削除しますか？
          </DialogTitle>
          <DialogContent>削除したビューはもとに戻せません</DialogContent>
          <DialogActions position="start">
            <Button>キャンセル</Button>
          </DialogActions>
          <DialogActions position="end">
            <Button appearance="primary" onClick={onSubmit}>
              削除
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

export const OUTPUT_COORDINATES = [
  {
    name: "EPSG:4326 (WGS84)",
    code: "4326",
  },
  {
    name: "EPSG:3857 (Webメルカトル)",
    code: "3857",
  },
  {
    name: "EPSG:2443 (日本測地系2000 / 平面直角座標系 I)",
    code: "2443",
  },
  {
    name: "EPSG:2444 (日本測地系2000 / 平面直角座標系 II)",
    code: "2444",
  },
  {
    name: "EPSG:2445 (日本測地系2000 / 平面直角座標系 III)",
    code: "2445",
  },
  {
    name: "EPSG:2446 (日本測地系2000 / 平面直角座標系 IV)",
    code: "2446",
  },
  {
    name: "EPSG:2447 (日本測地系2000 / 平面直角座標系 V)",
    code: "2447",
  },
  {
    name: "EPSG:2448 (日本測地系2000 / 平面直角座標系 VI)",
    code: "2448",
  },
  {
    name: "EPSG:2449 (日本測地系2000 / 平面直角座標系 VII)",
    code: "2449",
  },
  {
    name: "EPSG:2450 (日本測地系2000 / 平面直角座標系 VIII)",
    code: "2450",
  },
  {
    name: "EPSG:2451 (日本測地系2000 / 平面直角座標系 IX)",
    code: "2451",
  },
  {
    name: "EPSG:2452 (日本測地系2000 / 平面直角座標系 X)",
    code: "2452",
  },
  {
    name: "EPSG:2453 (日本測地系2000 / 平面直角座標系 XI)",
    code: "2453",
  },
  {
    name: "EPSG:2454 (日本測地系2000 / 平面直角座標系 XII)",
    code: "2454",
  },
  {
    name: "EPSG:2455 (日本測地系2000 / 平面直角座標系 XIII)",
    code: "2455",
  },
  {
    name: "EPSG:2456 (日本測地系2000 / 平面直角座標系 XIV)",
    code: "2456",
  },
  {
    name: "EPSG:2457 (日本測地系2000 / 平面直角座標系 XV)",
    code: "2457",
  },
  {
    name: "EPSG:2458 (日本測地系2000 / 平面直角座標系 XVI)",
    code: "2458",
  },
  {
    name: "EPSG:2459 (日本測地系2000 / 平面直角座標系 XVII)",
    code: "2459",
  },
  {
    name: "EPSG:2460 (日本測地系2000 / 平面直角座標系 XVIII)",
    code: "2460",
  },
  {
    name: "EPSG:2461 (日本測地系2000 / 平面直角座標系 XIX)",
    code: "2461",
  },
];
