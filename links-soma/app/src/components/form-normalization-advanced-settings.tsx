import {
  Dialog,
  DialogTrigger,
  makeStyles,
  Radio,
  RadioGroup,
  Slider,
  tokens,
} from "@fluentui/react-components";
import { useController, useForm } from "react-hook-form";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useDialogState } from "../hooks/use-dialog-state";
import { defaultNormalizationParameters } from "../utils/default-normalization-parameters";
import { type PreprocessParameters } from "../@types/job-parameters";
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

type Props = {
  value: PreprocessParameters["settings"]["advanced"];
  onChange: (value: PreprocessParameters["settings"]["advanced"]) => void;
};

export const FormNormalizationAdvancedSettings = ({
  value,
  onChange,
}: Props): JSX.Element => {
  // Dialog内の状態管理のためでuseFormを導入
  const { reset, control, handleSubmit } = useForm<
    PreprocessParameters["settings"]["advanced"]
  >({
    defaultValues: value,
  });

  const { field: similarityThresholdField } = useController({
    name: "similarity_threshold",
    control,
  });

  const { field: nGramSizeField } = useController({
    name: "n_gram_size",
    control,
  });

  const { field: joiningMethodField } = useController({
    name: "joining_method",
    control,
  });

  const { isOpen, setIsOpen } = useDialogState();

  const styles = useStyles();

  const setDefaultValue = (): void => {
    reset(defaultNormalizationParameters.settings.advanced);
  };

  const onSubmit = handleSubmit((data) => {
    onChange(data);
    setIsOpen(false);
  });

  return (
    <Dialog
      onOpenChange={(_, data) => {
        setIsOpen(data.open);
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
              <Field className={styles.field} label={"N-gram Size"}>
                <RadioGroup
                  layout="horizontal"
                  onChange={nGramSizeField.onChange}
                  value={nGramSizeField.value.toString()}
                >
                  <Radio label={1} value={"1"} />
                  <Radio label={2} value={"2"} />
                  <Radio label={3} value={"3"} />
                </RadioGroup>
              </Field>
              <Field className={styles.field} label={"類似度のしきい値を調整"}>
                <div className={styles.sliderWrapper}>
                  <Input
                    ref={similarityThresholdField.ref}
                    max={1}
                    min={0}
                    onChange={similarityThresholdField.onChange}
                    step={0.01}
                    type="number"
                    value={similarityThresholdField.value.toString()}
                  />
                  <Slider
                    ref={similarityThresholdField.ref}
                    className={styles.slider}
                    max={1}
                    min={0}
                    onChange={similarityThresholdField.onChange}
                    step={0.01}
                    value={similarityThresholdField.value}
                  />
                </div>
              </Field>
            </div>
            <div className={styles.formSection}>
              <h4>空間結合</h4>
              <Field className={styles.field} label={"結合方式"}>
                <RadioGroup
                  layout="horizontal"
                  onChange={joiningMethodField.onChange}
                  value={joiningMethodField.value}
                >
                  <Radio label={"交差結合"} value={"intersection"} />
                  <Radio label={"最近傍結合"} value={"nearest"} />
                </RadioGroup>
              </Field>
            </div>
          </DialogContent>
          <DialogActions position="start">
            {/* 以下ボタンを押下しても, stateは更新されず見た目のみで初期値が変わる. Form全体に反映させるのためには「変更」ボタンの押下が必要です */}
            <Button
              appearance="transparent"
              onClick={setDefaultValue}
              size="medium"
            >
              デフォルトに戻す
            </Button>
          </DialogActions>
          <DialogActions position="end">
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="primary" onClick={onSubmit}>
                変更
              </Button>
            </DialogTrigger>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
