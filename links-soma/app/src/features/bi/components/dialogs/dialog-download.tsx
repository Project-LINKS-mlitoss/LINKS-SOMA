import { Dismiss24Regular } from "@fluentui/react-icons";
import {
  Dialog,
  DialogTrigger,
  makeStyles,
  tokens,
  Option,
  Spinner,
} from "@fluentui/react-components";
import { Suspense, useMemo, useState } from "react";
import { FormProvider, useFormContext } from "react-hook-form";
import { type SelectResultView } from "../../../../db/schema";
import {
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogActions,
  Button,
  DialogContent,
  Dropdown,
  Fieldset,
  FieldLegend,
} from "../../../../shared/components/ui";
import { type useDialogState } from "../../../../shared/hooks/use-dialog-state";
import { rendererLogger } from "../../../../shared/utils/renderer-logger";
import { OUTPUT_FILE_TYPES } from "../../../../shared/config/file-types";
import { OUTPUT_COORDINATES } from "../../../../shared/config/output-coordinates";
import { type EditViewFormType } from "../../types/models/form";
import { floatToPercent, toFloat } from "../../util";
import {
  useDownloadCountPreview,
  useEditResultViewFields,
  useEditViewForm,
} from "../../hooks";
import { EditResultViewFilterFields } from "../forms/edit-result-view-filter-fields";
import { ColumnFields } from "../forms/edit-result-view-fields/_column-fields";

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
  countRow: {
    display: "flex",
    alignItems: "baseline",
    gap: tokens.spacingHorizontalXS,
    fontSize: "12px",
  },
  countNumber: {
    fontSize: "16px",
    fontWeight: "700",
  },
});

type Props = {
  onSubmit: (fileType: string, coordinate: string) => void;
  /** ダイアログの開閉状態を制御 */
  dialogState: ReturnType<typeof useDialogState>;
  /** ダウンロード対象のビュー（件数プレビュー・フィルター/カラム編集に使用） */
  resultView: SelectResultView;
};

export function DownloadDialog({
  onSubmit,
  dialogState,
  resultView,
}: Props): JSX.Element {
  const { isOpen, setIsOpen } = dialogState;

  return (
    <Dialog onOpenChange={(_, { open }) => setIsOpen(open)} open={isOpen}>
      <DialogSurface>
        {/* 開いている間だけフォームを構築する。閉じている全ビューのカードで
            useEditViewForm が走るのを避ける */}
        {isOpen && (
          <DownloadDialogForm
            onClose={() => setIsOpen(false)}
            onExport={onSubmit}
            resultView={resultView}
          />
        )}
      </DialogSurface>
    </Dialog>
  );
}

function DownloadDialogForm({
  onExport,
  onClose,
  resultView,
}: {
  onExport: (fileType: string, coordinate: string) => void;
  onClose: () => void;
  resultView: SelectResultView;
}): JSX.Element {
  const styles = useStyles();
  const [selectedFileType, setSelectedFileType] = useState<string>(
    OUTPUT_FILE_TYPES[0].type,
  );
  const [selectedCoordinate, setSelectedCoordinate] = useState(
    OUTPUT_COORDINATES[0].code,
  );

  // defaultValues の identity が変わると useEditViewForm の resetForm が
  // form.reset を走らせ、親フォームの再レンダーを連発させる。
  // SWR の再検証で resultView の identity は中身が同じでも変わるため、
  // 値ベースのキーで固定し、実際に値が変わったときだけ作り直す。
  const valueKey = JSON.stringify({
    id: resultView.id,
    dataSetResultId: resultView.data_set_result_id,
    title: resultView.title,
    style: resultView.style,
    unit: resultView.unit,
    parameters: resultView.parameters,
  });
  const defaultValues = useMemo<EditViewFormType>(
    () => ({
      dataSetResultId: resultView.data_set_result_id ?? undefined,
      title: resultView.title ?? "",
      style: resultView.style ?? "map-with-table",
      unit: resultView.unit ?? "building",
      parameters: floatToPercent(resultView.parameters ?? []) ?? [],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resultView は valueKey で値比較する
    [valueKey],
  );

  const { form, onSubmit: saveParameters } = useEditViewForm({
    defaultValues,
    selectedResultSheetId: resultView.sheet_id ?? undefined,
    selectedResultViewId: resultView.id,
  });

  const handleDownload = async (): Promise<void> => {
    // 出力本体は view_id 経由の保存済みパラメータを読むため、先に保存してから出力する。
    // バリデーション失敗時は保存されない（handleSubmit は失敗でも resolve する）ので、
    // 先に trigger で検証し、不正なら出力もしない（編集前の古い値での出力を防ぐ）
    const isValid = await form.trigger();
    if (!isValid) return;
    try {
      // handleSubmit は onValid 内（updateResultViews IPC）の例外を再スローする。
      // 保存に失敗したら古い保存値での出力を避けるため、出力せずダイアログを開いたまま中断する
      await saveParameters();
    } catch (error) {
      rendererLogger.error("Failed to save view before export", error, {
        component: "DownloadDialogForm",
      });
      return;
    }
    onExport(selectedFileType, selectedCoordinate);
    onClose();
  };

  return (
    <FormProvider {...form}>
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
          <Fieldset>
            <FieldLegend>出力設定</FieldLegend>
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
          </Fieldset>
          <Suspense>
            <EditResultViewFilterFields resultView={resultView} />
          </Suspense>
          <DownloadColumnSection
            dataSetResultId={resultView.data_set_result_id}
          />
          <DownloadCountPreview
            dataSetResultId={resultView.data_set_result_id}
          />
        </DialogContent>
        <DialogActions>
          <Button appearance="primary" onClick={() => void handleDownload()}>
            ダウンロード準備を開始する
          </Button>
        </DialogActions>
      </DialogBody>
    </FormProvider>
  );
}

/**
 * 出力カラム選択セクション。
 *
 * 出力カラム（columns パラメータ）を持つ表・地図ビューでのみ表示する。
 * チャートビューは出力カラムの概念がなく全カラム出力のため非表示。
 * FormProvider 配下の子として描画する必要がある（useEditResultViewFields が
 * useFormContext を利用するため）。
 */
function DownloadColumnSection({
  dataSetResultId,
}: {
  dataSetResultId: SelectResultView["data_set_result_id"];
}): JSX.Element | null {
  const editFieldsState = useEditResultViewFields({ dataSetResultId });
  const style = editFieldsState.form.watch("style");

  if (style !== "table" && style !== "map-with-table") return null;

  return (
    <Fieldset>
      <FieldLegend>出力カラム</FieldLegend>
      <ColumnFields {...editFieldsState} />
    </Fieldset>
  );
}

/**
 * 出力予定件数プレビュー。
 *
 * FormProvider 配下の子として描画し、件数の取得状態を自身に閉じ込める。
 * これによりフィルター/カラム節を再レンダーで巻き込まない。
 * 件数IPCは保存済み（toFloat）形式を前提とするため、編集中の percent 値を変換して渡す。
 */
function DownloadCountPreview({
  dataSetResultId,
}: {
  dataSetResultId: SelectResultView["data_set_result_id"];
}): JSX.Element {
  const styles = useStyles();
  const { watch } = useFormContext<EditViewFormType>();
  const parameters = watch("parameters");
  const unit = watch("unit");

  const { count, isLoading } = useDownloadCountPreview({
    dataSetResultId: dataSetResultId ?? 0,
    unit: unit ?? "building",
    parameters: toFloat(parameters ?? []),
    enabled: !!dataSetResultId,
  });

  return (
    <div className={styles.countRow}>
      <span>出力予定件数:</span>
      {isLoading ? (
        <Spinner size="tiny" />
      ) : (
        <>
          <span className={styles.countNumber}>
            {count?.toLocaleString() ?? "--"}
          </span>
          <span>件</span>
        </>
      )}
    </div>
  );
}
