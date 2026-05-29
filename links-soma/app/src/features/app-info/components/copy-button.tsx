import { useState } from "react";
import {
  Button,
  Tooltip,
  makeStyles,
  tokens,
  mergeClasses,
} from "@fluentui/react-components";
import { Copy16Regular, Checkmark16Filled } from "@fluentui/react-icons";
import { rendererLogger } from "../../../shared/utils/renderer-logger";

const useStyles = makeStyles({
  button: {
    minWidth: "20px",
    width: "20px",
    height: "20px",
    padding: "2px",
    backgroundColor: "transparent",
    border: "none",
    color: tokens.colorNeutralForeground2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      color: tokens.colorNeutralForeground1,
    },
    ":active": {
      backgroundColor: tokens.colorNeutralBackground1Pressed,
    },
  },
  copied: {
    color: tokens.colorPaletteGreenForeground1,
  },
  icon: {
    width: "16px",
    height: "16px",
    transition: "all 0.2s ease",
  },
});

interface CopyButtonProps {
  value: string;
  onCopy?: () => void;
}

export const CopyButton = ({ value, onCopy }: CopyButtonProps): JSX.Element => {
  const styles = useStyles();
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setIsCopied(true);
      onCopy?.();

      rendererLogger.info("テキストをクリップボードにコピーしました", {
        value: value.substring(0, 50) + (value.length > 50 ? "..." : ""),
      });

      // 2秒後に元に戻す
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (error) {
      rendererLogger.error(
        "クリップボードへのコピーに失敗しました",
        error as Error,
        {
          value: value.substring(0, 50) + (value.length > 50 ? "..." : ""),
        },
      );
    }
  };

  return (
    <Tooltip
      content={isCopied ? "Copied!" : "クリックしてコピー"}
      positioning="above"
      relationship="label"
      withArrow
    >
      <Button
        appearance="subtle"
        className={mergeClasses(styles.button, isCopied && styles.copied)}
        icon={
          isCopied ? (
            <Checkmark16Filled className={styles.icon} />
          ) : (
            <Copy16Regular className={styles.icon} />
          )
        }
        onClick={handleCopy}
        size="small"
      />
    </Tooltip>
  );
};
