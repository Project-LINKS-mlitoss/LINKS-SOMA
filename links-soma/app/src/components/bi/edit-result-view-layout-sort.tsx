import { ChevronRightRegular, ChevronLeftRegular } from "@fluentui/react-icons";
import { makeStyles, tokens } from "@fluentui/react-components";
import { useFetchResultView } from "../../hooks/use-fetch-result-view";
import { useFetchResultViews } from "../../hooks/use-fetch-result-views";
import { Field } from "../ui/field";
import { Button } from "../ui/button";
import { useWorkbookIdsSearchQuery } from "../../bi-modules/hooks/use-workbook-ids-search-query";

const useStyles = makeStyles({
  inner: {
    display: "flex",
    justifyContent: "center",
    gap: tokens.spacingHorizontalXL,
  },
});

export const EditResultViewLayoutSort = (): JSX.Element => {
  const styles = useStyles();

  const { viewId } = useWorkbookIdsSearchQuery();
  const { data: selectedResultView, mutate: mutateResultView } =
    useFetchResultView({
      resultViewId: Number(viewId),
    });
  const { data: resultViews, mutate: mutateResultViews } = useFetchResultViews({
    sheetId: selectedResultView?.sheet_id,
  });

  /** validationはbuttonのdisabledで管理 */
  const handleNext = async (): Promise<void> => {
    if (!viewId) return;
    if (!selectedResultView?.sheet_id) return;
    await window.ipcRenderer.invoke("updateResultViewsLayoutIndex", {
      sheetId: selectedResultView.sheet_id,
      resultViewId: Number(viewId),
      value: {
        layoutIndex: selectedResultView?.layoutIndex || 0,
      },
    });
    void mutateResultView();
    void mutateResultViews();
  };

  /** validationはbuttonのdisabledで管理 */
  const handlePrev = async (): Promise<void> => {
    if (!viewId) return;
    if (!selectedResultView?.sheet_id) return;
    await window.ipcRenderer.invoke("updateResultViewsLayoutIndex", {
      sheetId: selectedResultView.sheet_id,
      resultViewId: Number(viewId),
      value: {
        layoutIndex: (selectedResultView?.layoutIndex || 0) - 2,
      },
    });
    void mutateResultView();
    void mutateResultViews();
  };

  if (!selectedResultView) return <></>;

  return (
    <Field label="ビューの並び替え">
      <div className={styles.inner}>
        <Button
          disabled={!viewId || selectedResultView?.layoutIndex === 1}
          icon={<ChevronLeftRegular />}
          onClick={handlePrev}
        >
          前へ
        </Button>
        <Button
          disabled={selectedResultView?.layoutIndex === resultViews?.length}
          icon={<ChevronRightRegular />}
          onClick={handleNext}
        >
          次へ
        </Button>
      </div>
    </Field>
  );
};
