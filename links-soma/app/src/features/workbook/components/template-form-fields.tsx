/**
 * テンプレートの名前・説明の入力フィールド（新規保存・編集で共有, FR021）。
 *
 * 「テンプレートとして保存」ダイアログと「ビューを追加」内の編集ダイアログで
 * 同じフォーム体裁を使うため、フィールド定義をここに集約する（DRY / 体裁統一）。
 * 値の保持・送信は呼び出し側が担い、本コンポーネントは表示と onChange のみ持つ。
 */

import { makeStyles, Textarea } from "@fluentui/react-components";
import { Field, Input } from "../../../shared/components/ui";
import { lang } from "../../../shared/config/lang";

const t = lang.components["view-preset"];

export type TemplateFormValues = {
  name: string;
  description: string;
};

const useStyles = makeStyles({
  field: {
    width: "100%",
  },
});

export const TemplateFormFields = ({
  values,
  onChange,
}: {
  values: TemplateFormValues;
  onChange: (values: TemplateFormValues) => void;
}): JSX.Element => {
  const styles = useStyles();
  return (
    <>
      <Field label={t.saveNameLabel}>
        <Input
          className={styles.field}
          onChange={(_, data) => onChange({ ...values, name: data.value })}
          placeholder={t.saveNamePlaceholder}
          value={values.name}
        />
      </Field>
      <Field label={t.descriptionLabel}>
        <Textarea
          className={styles.field}
          onChange={(_, data) =>
            onChange({ ...values, description: data.value })
          }
          placeholder={t.descriptionPlaceholder}
          resize="vertical"
          value={values.description}
        />
      </Field>
    </>
  );
};
