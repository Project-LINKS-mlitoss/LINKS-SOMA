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
    watch,
    formState: { errors, touchedFields },
  } = useFormContext();

  const apiType = watch('apiType');
  const hasError = Boolean(errors.apiToken && touchedFields.apiToken);

  // Hide input field for ABR (data is pre-downloaded, no token needed)
  if (apiType === 'abr') {
    return <></>;
  }

  // Determine label and placeholder based on API type
  const title = apiType === 'ntt' ? 'APIのappid' : 'APIトークン';
  const placeholder = apiType === 'ntt' ? 'APIのappidを入力' : 'APIキーを入力';

  return (
    <Card>
      <div className={styles.title}>{title}</div>
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
          placeholder={placeholder}
          {...register('apiToken', { 
            required: apiType === 'abr' ? false : 'この項目は必須です' 
          })}
        />
      </Field>
    </Card>
  );
};
