import { ChevronRightRegular, ChevronLeftRegular } from "@fluentui/react-icons";
import { makeStyles, tokens } from "@fluentui/react-components";
import { useAtom } from "jotai";
import { selectedResultViewIdAtom } from "../../state/selected-result-view-id-atom";
import { useFetchResultView } from "../../hooks/use-fetch-result-view";
import { useFetchResultViews } from "../../hooks/use-fetch-result-views";
import { Field } from "../ui/field";
import { Button } from "../ui/button";

const useStyles = makeStyles({
  inner: {
    display: "flex",
    justifyContent: "center",
    gap: tokens.spacingHorizontalXL,
  },
});

export const EditResultViewLayoutSort = (): JSX.Element => {
  const styles = useStyles();

  const [selectedResultViewId] = useAtom(selectedResultViewIdAtom);
  const { data: selectedResultView, mutate: mutateResultView } =
    useFetchResultView({
      resultViewId: selectedResultViewId,
    });
  const { data: resultViews, mutate: mutateResultViews } = useFetchResultViews({
    sheetId: selectedResultView?.sheet_id,
  });

  /** validationはbuttonのdisabledで管理 */
  const handleNext = async (): Promise<void> => {
    if (!selectedResultViewId) return;
    if (!selectedResultView?.sheet_id) return;
    await window.ipcRenderer.invoke("updateResultViewsLayoutIndex", {
      sheetId: selectedResultView.sheet_id,
      resultViewId: selectedResultViewId,
      value: {
        layoutIndex: selectedResultView?.layoutIndex || 0,
      },
    });
    void mutateResultView();
    void mutateResultViews();
  };

  /** validationはbuttonのdisabledで管理 */
  const handlePrev = async (): Promise<void> => {
    if (!selectedResultViewId) return;
    if (!selectedResultView?.sheet_id) return;
    await window.ipcRenderer.invoke("updateResultViewsLayoutIndex", {
      sheetId: selectedResultView.sheet_id,
      resultViewId: selectedResultViewId,
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
          disabled={
            !selectedResultViewId || selectedResultView?.layoutIndex === 1
          }
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
