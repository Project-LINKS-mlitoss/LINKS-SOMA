import {
  Dialog,
  DialogTrigger,
  makeStyles,
  Slider,
  tokens,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { useDialogState } from "../hooks/use-dialog-state";
import { DialogSurface } from "./ui/dialog-surface";
import { DialogBody } from "./ui/dialog-body";
import { DialogTitle } from "./ui/dialog-title";
import { DialogContent } from "./ui/dialog-content";
import { Field } from "./ui/field";
import { Input } from "./ui/input";
import { DialogActions } from "./ui/dialog-actions";
import { Button } from "./ui/button";

const useStyles = makeStyles({
  field: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    "& label": {
      marginBottom: 0,
      flexBasis: "140px",
    },
  },
  sliderWrapper: {
    display: "flex",
    alignItems: "center",
    flex: 1,
    gap: tokens.spacingHorizontalS,
  },
  slider: {
    flex: 1,
    "& .fui-Slider__rail": {
      "&::before": {
        display: "none",
        background: "none",
      },
    },
  },
  dialogContent: {
    padding: 0,
    borderTop: "1px solid #e0e0e0",
  },
  formSection: {
    padding: `${tokens.spacingHorizontalL} ${tokens.spacingVerticalXXL}`,
    borderBottom: "1px solid #e0e0e0",
  },
});

type AdvancedSettingsType = {
  similarityThreshold: number;
};

type Props = {
  value: AdvancedSettingsType;
  onChange: (value: AdvancedSettingsType) => void;
};

export const DialogSetting = ({ value, onChange }: Props): JSX.Element => {
  const { isOpen, setIsOpen } = useDialogState();
  const styles = useStyles();

  const [localValue, setLocalValue] = useState<AdvancedSettingsType>(value);

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ): void => {
    const inputValue = parseFloat(event.target.value);
    setLocalValue((prev) => ({
      ...prev,
      similarityThreshold: inputValue,
    }));
  };

  const handleSliderChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    data: { value: number },
  ): void => {
    setLocalValue((prev) => ({
      ...prev,
      similarityThreshold: data.value,
    }));
  };

  const handleSubmit = (): void => {
    onChange(localValue);
    setIsOpen(false);
  };

  const handleReset = (): void => {
    const defaultValue = {
      similarityThreshold: 0, // デフォルト値
    };
    setLocalValue(defaultValue);
  };

  return (
    <Dialog
      onOpenChange={(_, data) => {
        setIsOpen(data.open);
        if (data.open) {
          // ダイアログを開いたときに親コンポーネントの値を反映
          setLocalValue(value);
        }
      }}
      open={isOpen}
    >
      <DialogTrigger>
        <Button appearance="transparent">高度な設定を変更</Button>
      </DialogTrigger>
      <DialogSurface>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button
                  appearance="subtle"
                  aria-label="close"
                  icon={
                    <Dismiss24Regular
                      color={tokens.colorNeutralForeground1}
                      strokeWidth={2}
                    />
                  }
                />
              </DialogTrigger>
            }
          >
            高度な設定の変更
          </DialogTitle>
          <DialogContent className={styles.dialogContent}>
            <div className={styles.formSection}>
              <h4>テキストマッチング</h4>
              <Field className={styles.field} label={"類似度のしきい値を調整"}>
                <div className={styles.sliderWrapper}>
                  <Input
                    max={1}
                    min={0}
                    onChange={handleInputChange}
                    step={0.1}
                    type="number"
                    value={localValue.similarityThreshold.toString()}
                  />
                  <Slider
                    className={styles.slider}
                    max={1}
                    min={0}
                    onChange={handleSliderChange}
                    step={0.1}
                    value={localValue.similarityThreshold}
                  />
                </div>
              </Field>
            </div>
          </DialogContent>
          <DialogActions position="start">
            <Button
              appearance="transparent"
              onClick={handleReset}
              size="medium"
            >
              デフォルトに戻す
            </Button>
          </DialogActions>
          <DialogActions position="end">
            <Button appearance="primary" onClick={handleSubmit}>
              変更
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
