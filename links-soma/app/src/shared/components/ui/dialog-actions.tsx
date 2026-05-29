import {
  type DialogActionsProps,
  DialogActions as FUIDialogActions,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { forwardRef } from "react";

const useStyles = makeStyles({
  dialogActions: {
    padding: ` ${tokens.spacingVerticalM}  ${tokens.spacingHorizontalXXL} ${tokens.spacingVerticalXXL}  ${tokens.spacingHorizontalXXL}`,
  },
});

export const DialogActions = forwardRef<HTMLDivElement, DialogActionsProps>(
  ({ className, children, ...props }, ref) => {
    const styles = useStyles();
    return (
      <FUIDialogActions
        {...props}
        ref={ref}
        className={mergeClasses(className, styles.dialogActions)}
      >
        {children}
      </FUIDialogActions>
    );
  },
);

DialogActions.displayName = "DialogActions";
