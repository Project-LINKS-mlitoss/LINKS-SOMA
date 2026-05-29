import { makeStyles, tokens } from "@fluentui/react-components";
import { Warning24Regular } from "@fluentui/react-icons";
import { type MapWithTableView } from "../../../../../types/models/view";

const useStyles = makeStyles({
  overlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: 10,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: tokens.spacingVerticalM,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow16,
    fontSize: tokens.fontSizeBase300,
  },
  icon: {
    color: tokens.colorPaletteYellowForeground1,
  },
  message: {
    textAlign: "center",
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase200,
  },
});

type Props = {
  unit: MapWithTableView["unit"];
};

export const ZoomWarningOverlay = ({ unit }: Props): JSX.Element => {
  const styles = useStyles();

  const unitLabel = unit === "building" ? "建物" : "地域";

  return (
    <div className={styles.overlay}>
      <Warning24Regular className={styles.icon} />
      <div className={styles.message}>
        ズームインすると{unitLabel}が表示されます
      </div>
    </div>
  );
};
