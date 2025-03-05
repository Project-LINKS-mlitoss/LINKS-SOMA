import { makeStyles, mergeClasses } from "@fluentui/react-components";
import { type ComponentPropsWithoutRef, forwardRef } from "react";

const useStyles = makeStyles({
  form: {},
});

export const Form = forwardRef<
  HTMLFormElement,
  ComponentPropsWithoutRef<"form">
>(({ className, ...props }, ref) => {
  const styles = useStyles();

  return (
    <form
      className={mergeClasses(className, styles.form)}
      {...props}
      ref={ref}
    />
  );
});

Form.displayName = "Form";
