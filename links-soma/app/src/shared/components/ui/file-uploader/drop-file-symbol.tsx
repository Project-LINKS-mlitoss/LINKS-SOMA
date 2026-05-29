import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { ArrowDownload28Filled } from "@fluentui/react-icons";
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

export const DropFileSymbol = (): JSX.Element => {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <ArrowDownload28Filled color={THEME_COLORS.primary} />
      <div>
        <p className={mergeClasses(styles.text, styles.highlighted)}>
          ファイルをドロップ
        </p>
      </div>
    </div>
  );
};
