import { useFormContext } from 'react-hook-form';
import {
  makeStyles,
  tokens,
  Input,
  Card,
  Field,
} from '@fluentui/react-components';

const useStyles = makeStyles({
  title: {
    fontWeight: tokens.fontWeightBold,
  },
  input: {
    width: '50%',
  },
});

export const ApiInput = (): JSX.Element => {
  const styles = useStyles();
  const {
    register,
    formState: { errors, touchedFields },
  } = useFormContext();

  const hasError = Boolean(errors.apiToken && touchedFields.apiToken);

  return (
    <Card>
      <div className={styles.title}>APIトークン</div>
      <Field
        validationState={hasError ? 'error' : undefined}
        validationMessage={
          hasError
            ? { children: errors.apiToken?.message as string }
            : undefined
        }
      >
        <Input
          className={styles.input}
          placeholder="APIキーを入力"
          {...register('apiToken', { required: 'この項目は必須です' })}
        />
      </Field>
    </Card>
  );
};
