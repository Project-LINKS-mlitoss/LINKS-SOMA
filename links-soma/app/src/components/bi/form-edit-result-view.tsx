import { FormProvider } from "react-hook-form";
import { Caption1Strong, makeStyles, tokens } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { type SelectResultSheet, type SelectResultView } from "../../schema";
import { useFetchResultView } from "../../hooks/use-fetch-result-view";
import { Button } from "../ui/button";
import { useEditViewForm } from "../../bi-modules/hooks/use-edit-view-form";
import { type EditViewFormType } from "../../bi-modules/interfaces/edit-view-form";
import { ErrorMessage } from "../error-message";
import { floatToPercent } from "../../bi-modules/util/floatTop";
import { useWorkbookIdsSearchQuery } from "../../bi-modules/hooks/use-workbook-ids-search-query";
import { EditResultViewFields } from "./edit-result-view-fields";
import { EditResultViewFilterFields } from "./edit-result-view-filter-fields";

const useStyles = makeStyles({
  form: {
    display: "grid",
    gap: "24px",
  },
  closeIcon: {
    height: "12px",
    width: "12px",
  },
  success: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    justifyContent: "center",
    position: "absolute",
    bottom: "-24px",
    width: "100%",
  },
  buttonContainer: {
    display: "grid",
    gap: "8px",
    position: "relative",
    marginBottom: "8px",
  },
});

export const FormEditResultView = (): JSX.Element | null => {
  const { sheetId, viewId } = useWorkbookIdsSearchQuery();

  /** ビューの初期値を取得 */
  const { data: selectedResultView, isLoading: isSelectedResultViewLoading } =
    useFetchResultView({
      resultViewId: Number(viewId),
    });

  if (isSelectedResultViewLoading) {
    return null;
  }

  return (
    <FormComponent
      defaultValues={{
        dataSetResultId: selectedResultView?.data_set_result_id ?? undefined,
        title: selectedResultView?.title ?? "",
        style: selectedResultView?.style ?? "map",
        unit: selectedResultView?.unit ?? "building",
        parameters: floatToPercent(selectedResultView?.parameters || []) ?? [],
      }}
      selectedResultSheetId={Number(sheetId)}
      selectedResultViewId={Number(viewId)}
    />
  );
};

function FormComponent({
  defaultValues,
  selectedResultSheetId,
  selectedResultViewId,
}: {
  defaultValues: EditViewFormType;
  selectedResultSheetId: SelectResultSheet["id"] | undefined;
  selectedResultViewId: SelectResultView["id"] | undefined;
}): JSX.Element {
  const styles = useStyles();

  const { form, selectedResultView, onSubmit } = useEditViewForm({
    defaultValues,
    selectedResultSheetId,
    selectedResultViewId,
  });
  const {
    formState: { errors, isDirty },
  } = form;

  const KEY_LABEL_MAP: Record<string, string> = {
    dataSetResultId: "データセット",
    title: "タイトル",
    style: "スタイル",
    unit: "単位",
    parameters: "パラメータ",
  };

  // 保存が成功したかどうかをハンドリングするためのステート
  const [success, setSuccess] = useState(false);
  useEffect(() => {
    if (isDirty) {
      setSuccess(false);
    }
  }, [isDirty]);
  useEffect(() => {
    setSuccess(false);
  }, [selectedResultViewId]);

  return selectedResultViewId && selectedResultView ? (
    <FormProvider {...form}>
      <form
        className={styles.form}
        onSubmit={async (e) => {
          try {
            await onSubmit(e);
            setSuccess(true);
            await new Promise((resolve) => setTimeout(resolve, 1500));
            setSuccess(false);
          } catch (error) {
            console.error(error);
          }
        }}
      >
        {Object.entries(errors).map(([key, error]) => (
          <ErrorMessage
            key={key}
            msg={`【${KEY_LABEL_MAP[key]}】の設定を確認してください.${error.message ? `(${error.message})` : ""}`}
          />
        ))}
        <EditResultViewFields
          dataSetResultId={selectedResultView.data_set_result_id}
        />
        <EditResultViewFilterFields resultView={selectedResultView} />
        <div className={styles.buttonContainer}>
          <Button appearance="primary" type="submit">
            入力内容を保存する
          </Button>
          {success && (
            <div className={styles.success}>
              <Caption1Strong>保存が完了しました</Caption1Strong>
              <Button
                appearance="transparent"
                onClick={() => setSuccess(false)}
              >
                <Dismiss24Regular
                  className={styles.closeIcon}
                  color={tokens.colorNeutralForeground1}
                />
              </Button>
            </div>
          )}
        </div>
      </form>
    </FormProvider>
  ) : (
    <>ビューを選択してください</>
  );
}
