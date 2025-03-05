import {
  Body1,
  Caption1,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useAtom } from "jotai";
import { formatDate } from "../utils/format-date";
import { type SelectDataSetResult } from "../schema";
import { selectedResultSheetIdAtom } from "../state/selected-result-sheet-id-atom";
import { selectedResultViewIdAtom } from "../state/selected-result-view-id-atom";
import { useFetchResultViews } from "../hooks/use-fetch-result-views";
import { Button } from "./ui/button";

type Props = {
  dataSetResults: SelectDataSetResult[] | undefined;
};

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
  },
  button: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: tokens.spacingVerticalXS,
  },
  term: {
    display: "flex",
    /** @fixme TokensからPrimaryカラーにアクセスする方法がわからない */
    backgroundColor: "#E9EAF6",
    color: "#6264A7",
    padding: tokens.spacingHorizontalXS,
    borderRadius: tokens.borderRadiusMedium,
  },
});

export const ListDataSetResults = ({ dataSetResults }: Props): JSX.Element => {
  const styles = useStyles();
  const [, setSelectedResultViewId] = useAtom(selectedResultViewIdAtom);
  const [selectedResultSheetId] = useAtom(selectedResultSheetIdAtom);
  const { data: resultViews, mutate } = useFetchResultViews({
    sheetId: selectedResultSheetId,
  });

  return (
    <div className={styles.root}>
      {dataSetResults?.map((item) => (
        <Button
          key={item.id}
          appearance="subtle"
          className={styles.button}
          onClick={async () => {
            if (!resultViews) return;
            const newLayoutIndex = resultViews.length + 1;
            const { insertedId } = await window.ipcRenderer.invoke(
              "insertResultViews",
              {
                data_set_result_id: item.id,
                sheet_id: selectedResultSheetId,
                layoutIndex: newLayoutIndex,
                parameters: [],
              },
            );
            void mutate();
            setSelectedResultViewId(insertedId);
          }}
          shape="square"
        >
          <Body1>{item.title}</Body1>
          <Caption1 className={styles.term}>
            {/** @todo created_atではなく作成年度あるいは推定日を表示することになる想定  */}
            {formatDate(item.created_at, "YYYY/MM/DD")}
          </Caption1>
        </Button>
      ))}
    </div>
  );
};
