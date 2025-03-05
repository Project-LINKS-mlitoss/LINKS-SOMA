import {
  type ButtonProps,
  Button as FUIButton,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { forwardRef } from "react";
import { THEME_COLORS } from "../../config/theme-colors";

const useStyles = makeStyles({
  small: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    fontSize: tokens.fontSizeBase200,
    minWidth: "60px",
    fontWeight: tokens.fontWeightBold,
  },
  medium: {
    padding: `${tokens.spacingVerticalMNudge} ${tokens.spacingHorizontalL}`,
    fontSize: tokens.fontSizeBase300,
    minWidth: "80px",
  },
  primary: {
    border: "none",
  },
  text: {
    padding: 0,
    border: "none",
    backgroundColor: "transparent",
    color: THEME_COLORS.primary,
    textDecoration: "underline",
    minWidth: "auto",
    fontWeight: tokens.fontWeightMedium,
    lineHeight: "30px",
  },
  secondary: {
    backgroundColor: tokens.colorNeutralForeground2,
    color: tokens.colorNeutralForegroundInverted,
    "&:hover": {
      backgroundColor: tokens.colorNeutralForeground2,
      color: tokens.colorNeutralForegroundInverted,
      opacity: 0.8,
    },
  },
  subtleIcon: {
    padding: 0,
    width: "24px",
    height: "24px",
    minWidth: "24px",
    "& span > svg": {
      width: "20px",
      height: "20px",
    },
  },
});

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      shape = "circular",
      className,
      size,
      appearance,
      children,
      icon,
      ...props
    },
    ref,
  ) => {
    const styles = useStyles();

    return (
      <FUIButton
        {...props}
        ref={ref}
        appearance={appearance}
        className={mergeClasses(
          className,
          size === "small" && styles.small,
          size === "medium" && styles.medium,
          appearance === "primary" && styles.primary,
          appearance === "secondary" && styles.secondary,
          appearance === "transparent" && styles.text,
          // iconのみのButtonの場合にiconが綺麗に表示されるようにする
          icon != null &&
            children == null &&
            appearance === "subtle" &&
            styles.subtleIcon,
        )}
        icon={icon}
        shape={shape}
        size={size}
      >
        {children}
      </FUIButton>
    );
  },
);

Button.displayName = "Button";
