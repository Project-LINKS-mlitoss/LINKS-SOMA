import {
  makeStyles,
  tokens,
  type FieldProps,
  Field as FUIField,
  mergeClasses,
} from '@fluentui/react-components';
import { forwardRef } from 'react';

const useStyles = makeStyles({
  field: {
    '& > label': {
      fontSize: tokens.fontSizeBase200,
      color: tokens.colorNeutralForeground3,
      marginBottom: tokens.spacingVerticalXS,
      padding: 0,
    },
  },
});

export const Field = forwardRef<HTMLDivElement, FieldProps>(
  ({ className, ...props }, ref) => {
    const styles = useStyles();
    return (
      <FUIField
        {...props}
        ref={ref}
        className={mergeClasses(className, styles.field)}
      />
    );
  }
);

Field.displayName = 'Field';
