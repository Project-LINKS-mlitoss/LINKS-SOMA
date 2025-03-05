import { AddFilled } from "@fluentui/react-icons";
import { makeStyles, TabList, tokens } from "@fluentui/react-components";
import { useAtom } from "jotai";
import { useEffect } from "react";
import { selectedResultSheetIdAtom } from "../state/selected-result-sheet-id-atom";
import { useFetchResultSheets } from "../hooks/use-fetch-result-sheets";
import { selectedResultViewIdAtom } from "../state/selected-result-view-id-atom";
import { Button } from "./ui/button";
import { ButtonEditableSheetTitle } from "./button-editable-sheet-title";
import { Tab } from "./ui/tab";

const useStyles = makeStyles({
  root: {
    display: "grid",
    gridTemplateColumns: "136px 1fr",
  },
  tabList: {
    overflowX: "scroll",
    "::-webkit-scrollbar": {
      display: "none",
    },
    gap: tokens.spacingHorizontalM,
  },
});

interface Props {
  workbookId: number | undefined;
}

export const TabListEditResultSheet = ({
  workbookId,
}: Props): JSX.Element | null => {
  const styles = useStyles();
  const { data: resultSheets, mutate } = useFetchResultSheets({
    workbookId,
  });
  const [selectedResultSheetId, setSelectedResultSheetId] = useAtom(
    selectedResultSheetIdAtom,
  );
  const [, setSelectedResultViewId] = useAtom(selectedResultViewIdAtom);

  useEffect(() => {
    if (!resultSheets || resultSheets?.length === 0) return;
    setSelectedResultSheetId((prev) => prev || resultSheets[0].id);
  }, [resultSheets, setSelectedResultSheetId]);

  if (!workbookId || !selectedResultSheetId || !resultSheets) return null;

  return (
    <div className={styles.root}>
      <Button
        appearance="subtle"
        icon={<AddFilled fontSize={16} />}
        onClick={async () => {
          const { insertedId } = await window.ipcRenderer.invoke(
            "insertResultSheets",
            {
              title: `シート${resultSheets.length + 1}`,
              workbook_id: workbookId,
            },
          );
          void mutate();
          setSelectedResultSheetId(insertedId);
          setSelectedResultViewId(undefined);
        }}
        shape="square"
      >
        シートを追加
      </Button>
      <TabList
        className={styles.tabList}
        onTabSelect={async (_, data) => {
          if (!data.value || typeof data.value !== "number") return;
          setSelectedResultSheetId(data.value);
          const resultViews = await window.ipcRenderer.invoke(
            "selectResultViews",
            {
              sheetId: data.value,
            },
          );
          const firstView = resultViews.find((view) => view.layoutIndex === 1);
          if (!firstView) return setSelectedResultViewId(undefined);
          setSelectedResultViewId(firstView.id);
        }}
        selectedValue={selectedResultSheetId}
      >
        {resultSheets.map((item) => (
          <Tab key={item.id} id={item.title || ""} value={item.id}>
            <ButtonEditableSheetTitle
              resultSheet={{
                id: item.id,
                title: item.title,
                workbook_id: workbookId,
              }}
            />
          </Tab>
        ))}
      </TabList>
    </div>
  );
};
