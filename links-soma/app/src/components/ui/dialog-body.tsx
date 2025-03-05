import {
  type DialogBodyProps,
  DialogBody as FUIDialogBody,
  makeStyles,
  mergeClasses,
} from "@fluentui/react-components";
import { forwardRef } from "react";

const useStyles = makeStyles({
  dialogBody: {
    gap: "12px",
  },
});

export const DialogBody = forwardRef<HTMLDivElement, DialogBodyProps>(
  ({ className, ...props }, ref) => {
    const styles = useStyles();
    return (
      <FUIDialogBody
        {...props}
        ref={ref}
        className={mergeClasses(className, styles.dialogBody)}
      />
    );
  },
);

DialogBody.displayName = "DialogBody";
