import { makeStyles, tokens } from "@fluentui/react-components";
import { AddFilled } from "@fluentui/react-icons";
import { useNavigate } from "react-router-dom";
import { useFetchResultViews } from "../hooks/use-fetch-result-views";
import { useFetchDataSetResults } from "../hooks/use-fetch-data-set-results";
import { ROUTES } from "../routes";
import { useWorkbookIdsSearchQuery } from "../bi-modules/hooks/use-workbook-ids-search-query";
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
  const navigate = useNavigate();
  const { workbookId, sheetId } = useWorkbookIdsSearchQuery();
  const { data: dataSetResults } = useFetchDataSetResults();

  const { data: resultViews, mutate } = useFetchResultViews({
    sheetId: Number(sheetId),
  });
  const handleClick = async (): Promise<void> => {
    if (!resultViews) return;
    const newLayoutIndex = resultViews.length + 1;
    const { insertedId } = await window.ipcRenderer.invoke(
      "insertResultViews",
      {
        data_set_result_id: dataSetResults?.[0]?.id,
        sheet_id: Number(sheetId),
        layoutIndex: newLayoutIndex,
        parameters: [],
      },
    );
    await mutate();
    navigate(
      ROUTES.ANALYSIS.WORKBOOK_EDIT({
        id: workbookId,
        queryParams: {
          sheetId,
          viewId: insertedId,
        },
      }),
    );
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
