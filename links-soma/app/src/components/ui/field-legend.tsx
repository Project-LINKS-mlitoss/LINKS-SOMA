import { makeStyles, tokens } from "@fluentui/react-components";
import { type ComponentPropsWithoutRef, forwardRef } from "react";

const useStyles = makeStyles({
  fieldLegend: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
});

export const FieldLegend = forwardRef<
  HTMLLegendElement,
  ComponentPropsWithoutRef<"legend">
>(({ className: _, children, ...props }, ref) => {
  const styles = useStyles();
  return (
    <legend {...props} ref={ref} className={styles.fieldLegend}>
      {children}
    </legend>
  );
});

FieldLegend.displayName = "FieldLegend";
