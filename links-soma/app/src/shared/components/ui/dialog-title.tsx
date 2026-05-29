import {
  DialogTitle as FUIDialogTitle,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { forwardRef } from "react";

const useStyles = makeStyles({
  dialogTitle: {
    fontSize: tokens.fontSizeBase400,
    lineHeight: "24px",
    height: "60px",
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL} ${tokens.spacingVerticalM} ${tokens.spacingHorizontalXXL}`,
  },
  dialogTitleWithAction: {
    fontSize: tokens.fontSizeBase400,
    lineHeight: "24px",
    height: "60px",
    padding: `${tokens.spacingVerticalXXL} 0 ${tokens.spacingVerticalM} ${tokens.spacingHorizontalXXL}`,
    "& + .fui-DialogTitle__action": {
      padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL} ${tokens.spacingVerticalM} 0`,
    },
  },
});

export const DialogTitle = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof FUIDialogTitle>
>(({ className, action, ...props }, ref) => {
  const styles = useStyles();

  return (
    <FUIDialogTitle
      {...props}
      ref={ref}
      action={action}
      className={mergeClasses(
        className,
        action == null ? styles.dialogTitle : styles.dialogTitleWithAction,
      )}
    />
  );
});

DialogTitle.displayName = "DialogTitle";
