import { Button, makeStyles, mergeClasses } from "@fluentui/react-components";
/** @fixme 隣接セレクタがmakeStylesで挙動しなかったため、全文表示の振る舞いに関するCSSのみ利用 */
import "./style.css";

const useStyles = makeStyles({
  seeAll: {
    textDecoration: "underline",
  },
});

type Props = {
  content: string;
};

/**
 * 本文の一部を省略して表示し、全文を表示するボタンを表示するコンポーネント
 * stateを利用せずCSSのみで実装
 */
export const SeeAll = ({ content }: Props): JSX.Element => {
  const styles = useStyles();
  if (content.length <= 108) return <>{content}</>;
  return (
    <>
      {content.slice(0, 108)}
      <span className="see-all-content-left">{content?.slice(108)}</span>
      {content.length > 108 && (
        <>
          <span className="see-all-ellipses">...</span>
          <Button
            appearance="transparent"
            className={mergeClasses(styles.seeAll, "see-all-content-button")}
            size="small"
          >
            全文見る
          </Button>
        </>
      )}
    </>
  );
};
