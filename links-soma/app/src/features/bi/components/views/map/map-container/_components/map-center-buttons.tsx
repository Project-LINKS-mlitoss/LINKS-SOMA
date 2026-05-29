import { ArrowResetRegular, SaveRegular } from "@fluentui/react-icons";
import { makeStyles, tokens } from "@fluentui/react-components";
import { Button } from "../../../../../../../shared/components/ui";

const useStyles = makeStyles({
  buttonContainer: {
    position: "absolute",
    top: tokens.spacingVerticalMNudge,
    left: tokens.spacingHorizontalXXL,
    zIndex: 1,
    display: "flex",
    alignContent: "center",
    gap: tokens.spacingHorizontalXS,
  },
  button: {
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow16,
  },
});

type Props = {
  isPreview?: boolean;
  centerIsDirty: boolean;
  resetCenter: () => void;
  saveCurrentCenter: () => Promise<void>;
};

export const MapCenterButtons = ({
  isPreview,
  centerIsDirty,
  resetCenter,
  saveCurrentCenter,
}: Props): JSX.Element => {
  const styles = useStyles();

  if (!centerIsDirty) return <></>;

  return (
    <div className={styles.buttonContainer}>
      <Button
        className={styles.button}
        icon={<ArrowResetRegular />}
        onClick={resetCenter}
      />
      {isPreview && (
        <Button icon={<SaveRegular />} onClick={saveCurrentCenter} size="small">
          現在の位置を保存
        </Button>
      )}
    </div>
  );
};
