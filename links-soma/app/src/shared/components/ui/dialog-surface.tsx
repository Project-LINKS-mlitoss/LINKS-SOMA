import { type DialogSurfaceProps } from "@fluentui/react-dialog";
import {
  DialogSurface as FUIDialogSurface,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { forwardRef } from "react";

const useStyles = makeStyles({
  dialogSurface: {
    boxShadow: tokens.shadow28,
    borderRadius: tokens.borderRadiusXLarge,
    minWidth: "450px",
    maxWidth: "800px",
    "@media (max-width: 840px)": {
      margin: "auto 20px",
    },
    padding: 0,
  },
});

export const DialogSurface = forwardRef<HTMLDivElement, DialogSurfaceProps>(
  ({ className, ...props }, ref) => {
    const styles = useStyles();

    return (
      <FUIDialogSurface
        {...props}
        ref={ref}
        className={mergeClasses(styles.dialogSurface, className)}
      />
    );
  },
);

DialogSurface.displayName = "DialogSurface";
