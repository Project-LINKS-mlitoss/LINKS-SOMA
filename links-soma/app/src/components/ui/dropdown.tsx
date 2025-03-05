import { forwardRef } from "react";
import {
  Dropdown as FUIDropdown,
  makeStyles,
  mergeClasses,
  tokens,
  type DropdownProps,
} from "@fluentui/react-components";

const useStyles = makeStyles({
  dropdown: {
    padding: `${tokens.spacingVerticalSNudge} ${tokens.spacingHorizontalM}`,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusXLarge,
    "&:after": {
      display: "none",
    },
    "&:active, &:hover, &:focus, &:focus-within": {
      border: `1px solid ${tokens.colorNeutralStroke1Pressed}`,
    },
    "& button": {
      padding: 0,
    },
  },
});

export const Dropdown = forwardRef<HTMLButtonElement, DropdownProps>(
  ({ className, ...props }, ref) => {
    const styles = useStyles();
    return (
      <FUIDropdown
        {...props}
        ref={ref}
        className={mergeClasses(className, styles.dropdown)}
      />
    );
  },
);

Dropdown.displayName = "Dropdown";
