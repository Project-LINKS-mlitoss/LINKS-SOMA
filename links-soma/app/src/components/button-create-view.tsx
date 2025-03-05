import { useAtom } from "jotai";
import { makeStyles, tokens } from "@fluentui/react-components";
import { AddFilled } from "@fluentui/react-icons";
import { selectedResultSheetIdAtom } from "../state/selected-result-sheet-id-atom";
import { useFetchResultViews } from "../hooks/use-fetch-result-views";
import { useFetchDataSetResults } from "../hooks/use-fetch-data-set-results";
import { selectedResultViewIdAtom } from "../state/selected-result-view-id-atom";
import { Button } from "./ui/button";

const useStyles = makeStyles({
  button: {
    border: `1px dashed ${tokens.colorNeutralStroke2}`,
    padding: tokens.spacingHorizontalL,
    margin: `${tokens.spacingVerticalM} 0`,
  },
});

export const ButtonCreateView = (): JSX.Element => {
  const styles = useStyles();
  const { data: dataSetResults } = useFetchDataSetResults();
  const [, setSelectedResultViewId] = useAtom(selectedResultViewIdAtom);
  const [selectedResultSheetId] = useAtom(selectedResultSheetIdAtom);
  const { data: resultViews, mutate } = useFetchResultViews({
    sheetId: selectedResultSheetId,
  });
  const handleClick = async (): Promise<void> => {
    if (!resultViews) return;
    const newLayoutIndex = resultViews.length + 1;
    const { insertedId } = await window.ipcRenderer.invoke(
      "insertResultViews",
      {
        data_set_result_id: dataSetResults?.[0]?.id,
        sheet_id: selectedResultSheetId,
        layoutIndex: newLayoutIndex,
        parameters: [],
      },
    );
    await mutate();
    setSelectedResultViewId(insertedId);
  };

  const isMaxViewLength = !!resultViews && resultViews.length >= 8;

  return (
    <Button
      className={styles.button}
      disabled={isMaxViewLength}
      icon={<AddFilled fontSize={16} />}
      onClick={handleClick}
      shape="rounded"
    >
      ビューを追加
    </Button>
  );
};
