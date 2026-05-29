import { AddFilled } from "@fluentui/react-icons";
import { makeStyles, TabList, tokens } from "@fluentui/react-components";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useFetchResultSheets } from "../../../shared/hooks/use-fetch-result-sheets";
import { ROUTES } from "../../../shared/config/routes";
import { Button } from "../../../shared/components/ui/button";
import { Tab } from "../../../shared/components/ui/tab";
import { ButtonEditableSheetTitle } from "./button-editable-sheet-title";

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
  workbookId: number;
  sheetId?: string | null;
}

export const TabListEditResultSheet = ({
  workbookId,
  sheetId,
}: Props): JSX.Element | null => {
  const styles = useStyles();
  const navigate = useNavigate();

  const { data: resultSheets, mutate } = useFetchResultSheets({
    workbookId,
  });

  /** sheetIdがクエリパラメータにない場合 */
  useEffect(() => {
    if (!resultSheets || resultSheets.length === 0 || !workbookId) return;
    if (!sheetId) {
      const firstSheetId = resultSheets[0].id;
      navigate(
        ROUTES.ANALYSIS.WORKBOOK_EDIT({
          id: workbookId,
          queryParams: {
            sheetId: firstSheetId,
          },
        }),
      );
    }
  }, [sheetId, resultSheets, workbookId, navigate]);

  if (!resultSheets) return null;

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
          navigate(
            ROUTES.ANALYSIS.WORKBOOK_EDIT({
              id: workbookId,
              queryParams: {
                sheetId: insertedId,
              },
            }),
          );
        }}
        shape="square"
      >
        シートを追加
      </Button>
      <TabList
        className={styles.tabList}
        onTabSelect={async (_, data) => {
          if (!data.value || typeof data.value !== "string") return;
          navigate(
            ROUTES.ANALYSIS.WORKBOOK_EDIT({
              id: workbookId,
              queryParams: {
                sheetId: data.value,
              },
            }),
          );
        }}
        selectedValue={sheetId}
      >
        {resultSheets.map((item) => (
          <Tab key={item.id} id={item.title || ""} value={String(item.id)}>
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
