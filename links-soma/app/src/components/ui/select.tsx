import {
  makeStyles,
  type SelectProps,
  tokens,
  Select as FUISelect,
  mergeClasses,
} from "@fluentui/react-components";
import { forwardRef } from "react";

const useStyles = makeStyles({
  select: {
    "& > select": {
      border: `1px solid ${tokens.colorNeutralStroke1}`,
      borderRadius: tokens.borderRadiusXLarge,
      "&:active, &:hover, &:focus, &:focus-within": {
        border: `1px solid ${tokens.colorNeutralStroke1Pressed}`,
      },
      color: tokens.colorNeutralForeground1Static,
      fontSize: tokens.fontSizeBase300,
      padding: `${tokens.spacingVerticalSNudge} ${tokens.spacingHorizontalM}`,
      height: "36px",
    },
    "&:focus-within::after": {
      display: "none",
    },
  },
});

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => {
    const styles = useStyles();
    return (
      <FUISelect
        {...props}
        ref={ref}
        className={mergeClasses(className, styles.select)}
      />
    );
  },
);

Select.displayName = "Select";
