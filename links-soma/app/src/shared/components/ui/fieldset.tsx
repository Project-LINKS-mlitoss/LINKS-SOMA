import { makeStyles, mergeClasses, tokens } from "@fluentui/react-components";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

const useStyles = makeStyles({
  fieldset: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusXLarge,
    padding: `0 ${tokens.spacingHorizontalL} ${tokens.spacingVerticalL} `,
    display: "grid",
    gap: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
  },
});

export const Fieldset = forwardRef<
  HTMLFieldSetElement,
  ComponentPropsWithoutRef<"fieldset">
>(({ className, children, ...props }, ref) => {
  const styles = useStyles();
  return (
    <fieldset
      {...props}
      ref={ref}
      className={mergeClasses(className, styles.fieldset)}
    >
      {children}
    </fieldset>
  );
});

Fieldset.displayName = "Fieldset";
