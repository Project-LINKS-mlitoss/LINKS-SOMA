import {
  makeStyles,
  tokens,
  Caption1,
  Caption1Strong,
} from "@fluentui/react-components";
import { WarningFilled } from "@fluentui/react-icons";
import { lang } from "../config/lang";

const useStyles = makeStyles({
  section: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorPaletteYellowBackground1,
    border: `1px solid ${tokens.colorPaletteYellowBorder1}`,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    color: tokens.colorPaletteYellowForeground2,
  },
  icon: {
    fontSize: tokens.fontSizeBase400,
  },
  files: {
    paddingLeft: tokens.spacingHorizontalL,
    color: tokens.colorNeutralForeground2,
  },
});

/**
 * アップロードファイルの文字コード注意（PV-01・非ブロッキング）。
 * UTF-8 として読めないファイルを黄色警告で提示する。処理は止めない。
 * 対象ファイルが無ければ何も描画しない。
 */
export const EncodingWarning = ({
  fileNames,
}: {
  fileNames: string[];
}): JSX.Element | null => {
  const styles = useStyles();
  if (fileNames.length === 0) return null;

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <WarningFilled className={styles.icon} />
        <Caption1Strong>
          {lang.components.normalizationPreValidation.messages.encodingNotUtf8}
        </Caption1Strong>
      </div>
      <div className={styles.files}>
        {fileNames.map((name) => (
          <Caption1 key={name} block>
            └ {name}
          </Caption1>
        ))}
      </div>
    </div>
  );
};
