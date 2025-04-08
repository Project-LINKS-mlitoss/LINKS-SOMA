import { makeStyles } from "@fluentui/react-components";
import { useFetchResultViews } from "../hooks/use-fetch-result-views";
import { TileResultView } from "./bi/tile-result-view";
import { ButtonCreateView } from "./button-create-view";
import { EmptyEditResultViews } from "./empty-edit-result-views";

const useStyles = makeStyles({
  root: {
    display: "grid",
    gap: "16px",
  },
  template2th: {
    display: "grid",
    gap: "16px",
    gridTemplateAreas: "'view1' 'view2'",
  },
  template3th: {
    display: "grid",
    gap: "16px",
    gridTemplateRows: "max-content max-content",
    gridTemplateColumns: "1fr 1fr",
    gridTemplateAreas: "'view1 view1' 'view2 view3'",
  },
  template4th: {
    display: "grid",
    gap: "16px",
    gridTemplateColumns: "repeat(2, 1fr)",
    gridTemplateRows: "min-content min-content",
    gridTemplateAreas: "'view1 view2' 'view3 view4'",
  },
  view1: {
    gridArea: "view1",
  },
  view2: {
    gridArea: "view2",
  },
  view3: {
    gridArea: "view3",
  },
  view4: {
    gridArea: "view4",
  },
});

type Props = {
  sheetId: string;
};

/**
 * ビューの追加画面で表示されるシートのプレビュー
 */
export const PreviewResultSheet = ({ sheetId }: Props): JSX.Element | null => {
  const styles = useStyles();
  const { data } = useFetchResultViews({
    sheetId: Number(sheetId),
  });

  if (!data) return null;

  if (data.length === 0) return <EmptyEditResultViews />;

  const resultViewsGridTemplate = (() => {
    switch (data.length) {
      case 1:
        return "";
      case 2:
        return styles.template2th;
      case 3:
        return styles.template3th;
      case 4:
        return styles.template4th;
      default:
        return styles.template4th;
    }
  })();

  return (
    <div className={styles.root}>
      <div className={resultViewsGridTemplate}>
        {data.map((item) => (
          <TileResultView
            key={item.id}
            className={styles[`view${item.layoutIndex}` as keyof typeof styles]}
            focusable
            resultView={item}
          />
        ))}
      </div>
      {data.length !== 0 && <ButtonCreateView />}
    </div>
  );
};
