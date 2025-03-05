import {
  makeStyles,
  type TabProps,
  Tab as FUITab,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { forwardRef } from "react";
import { THEME_COLORS } from "../../config/theme-colors";

const useStyles = makeStyles({
  tab: {
    padding: 0,
    paddingBottom: "5px",
    "&::after": {
      width: "100%",
      transform: "translate(0, 100%)",
      left: 0,
      bottom: 0,
      backgroundColor: THEME_COLORS.primary,
    },
    "&:hover::before": {
      width: "100%",
      transform: "none",
      left: 0,
      bottom: "0",
      borderRadius: 0,
    },
    fontSize: tokens.fontSizeBase300,
    color: THEME_COLORS.primary,
    "& .fui-Tab__content": {
      color: THEME_COLORS.primary,
      padding: `0 ${tokens.spacingHorizontalXXS}`,
    },
    '&[aria-selected="true"] .fui-Tab__content': {
      color: THEME_COLORS.primary,
      fontWeight: tokens.fontWeightRegular,
    },
  },
});

export const Tab = forwardRef<HTMLButtonElement, TabProps>(
  ({ className, ...props }, ref) => {
    const styles = useStyles();
    return (
      <FUITab
        {...props}
        ref={ref}
        className={mergeClasses(className, styles.tab)}
      />
    );
  },
);

Tab.displayName = "Tab";
