import {
  type InputProps,
  makeStyles,
  mergeClasses,
  tokens,
  Input as FUIInput,
} from "@fluentui/react-components";
import { forwardRef } from "react";

const useStyles = makeStyles({
  input: {
    padding: `${tokens.spacingVerticalSNudge} ${tokens.spacingHorizontalM}`,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusXLarge,
    "& input": {
      padding: 0,
    },
    "&:after": {
      display: "none",
    },
  },
  enabled: {
    "&:active, &:hover, &:focus, &:focus-within": {
      border: `1px solid ${tokens.colorNeutralStroke1Pressed}`,
      borderBottomColor: tokens.colorNeutralStroke1Pressed, // 既存スタイル上書きのため優先度を限定してスタイルを指定
    },
  },
  disabled: {
    backgroundColor: tokens.colorNeutralBackgroundDisabled,
    color: tokens.colorNeutralForegroundDisabled,
  },
});

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, disabled, ...props }, ref) => {
    const styles = useStyles();
    return (
      <FUIInput
        {...props}
        ref={ref}
        className={mergeClasses(
          className,
          styles.input,
          disabled ? styles.disabled : styles.enabled,
        )}
        disabled={disabled}
      />
    );
  },
);

Input.displayName = "Input";
