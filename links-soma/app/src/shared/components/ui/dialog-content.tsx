import {
  type DialogContentProps as FUIDialogContentProps,
  DialogContent as FUIDialogContent,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { forwardRef } from "react";

const useStyles = makeStyles({
  dialogContent: {
    padding: `${tokens.spacingVerticalM}  ${tokens.spacingHorizontalXXL} ${tokens.spacingVerticalM} ${tokens.spacingHorizontalXXL}`,
  },
  dialogContentBordered: {
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
});

type DialogContentProps = FUIDialogContentProps & {
  border?: boolean;
  padding?: boolean;
};

export const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, padding = true, border, ...props }, ref) => {
    const styles = useStyles();
    return (
      <FUIDialogContent
        {...props}
        ref={ref}
        className={mergeClasses(
          padding && styles.dialogContent,
          border && styles.dialogContentBordered,
          className,
        )}
      />
    );
  },
);

DialogContent.displayName = "DialogContent";
