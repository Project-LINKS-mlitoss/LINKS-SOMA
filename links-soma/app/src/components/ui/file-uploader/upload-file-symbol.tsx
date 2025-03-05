import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { THEME_COLORS } from "../../../config/theme-colors";

const useStyles = makeStyles({
  text: {
    fontSize: tokens.fontSizeBase200,
    textAlign: "center",
  },
  highlighted: {
    color: THEME_COLORS.primary,
    fontWeight: tokens.fontWeightBold,
  },
  underline: {
    textDecoration: "underline",
  },
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: tokens.spacingVerticalS,
  },
});

export const UploadFileSymbol = (): JSX.Element => {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <img alt="upload file" src="/file-upload-icon.svg" />
      <div>
        <p className={mergeClasses(styles.text, styles.highlighted)}>
          ここにドラッグ&ドロップ
        </p>
        <p className={styles.text}>
          または
          <span className={mergeClasses(styles.highlighted, styles.underline)}>
            クリック
          </span>
          してアップロード
        </p>
      </div>
    </div>
  );
};
