import { type FieldPath } from "react-hook-form";
import { type z } from "zod";
import { type schema as formModelCreateSchema } from "../../hooks/use-form-model-create";
import { lang } from "../../../../shared/config/lang";

export type FormType = z.infer<typeof formModelCreateSchema>;

type AdvancedField = {
  key: FieldPath<FormType["settings"]["advanced"]>;
  label: string;
  placeholder: string;
  step?: string;
  type: "number" | "checkbox";
  description?: string;
  category?: string;
  max?: number;
  min?: number;
};

export const FIELDS: AdvancedField[] = [
  {
    key: "test_size",
    label: lang.components["dialog-model-advanced"].test_size.label,
    description: lang.components["dialog-model-advanced"].test_size.description,
    placeholder: "0.0",
    step: "0.1",
    type: "number",
  },
  {
    key: "n_splits",
    label: lang.components["dialog-model-advanced"].n_splits.label,
    description: lang.components["dialog-model-advanced"].n_splits.description,
    placeholder: "0",
    step: "1",
    type: "number",
  },
  {
    key: "undersample",
    label: lang.components["dialog-model-advanced"].undersample.label,
    description:
      lang.components["dialog-model-advanced"].undersample.description,
    placeholder: "false",
    step: "1",
    type: "checkbox",
  },
  {
    key: "undersample_ratio",
    label: lang.components["dialog-model-advanced"].undersample_ratio.label,
    description:
      lang.components["dialog-model-advanced"].undersample_ratio.description,
    placeholder: "0.0",
    step: "0.1",
    type: "number",
  },
  {
    key: "threshold",
    label: lang.components["dialog-model-advanced"].threshold.label,
    description: lang.components["dialog-model-advanced"].threshold.description,
    placeholder: "0.0",
    step: "0.1",
    type: "number",
  },
  {
    key: "hyperparameter_flag",
    label: lang.components["dialog-model-advanced"].hyperparameter_flag.label,
    description:
      lang.components["dialog-model-advanced"].hyperparameter_flag.description,
    placeholder: "false",
    step: "1",
    type: "checkbox",
  },
  {
    key: "n_trials",
    label: lang.components["dialog-model-advanced"].n_trials.label,
    description: lang.components["dialog-model-advanced"].n_trials.description,
    placeholder: "0",
    step: "1",
    type: "number",
  },
  {
    key: "lambda_l1",
    label: lang.components["dialog-model-advanced"].lambda_l1.label,
    description: lang.components["dialog-model-advanced"].lambda_l1.description,
    placeholder: "0.0",
    step: "0.1",
    type: "number",
  },
  {
    key: "lambda_l2",
    label: lang.components["dialog-model-advanced"].lambda_l2.label,
    description: lang.components["dialog-model-advanced"].lambda_l2.description,
    placeholder: "0.0",
    step: "0.1",
    type: "number",
  },
  {
    key: "num_leaves",
    label: lang.components["dialog-model-advanced"].num_leaves.label,
    description:
      lang.components["dialog-model-advanced"].num_leaves.description,
    placeholder: "0",
    step: "1",
    type: "number",
  },
  {
    key: "feature_fraction",
    label: lang.components["dialog-model-advanced"].feature_fraction.label,
    description:
      lang.components["dialog-model-advanced"].feature_fraction.description,
    placeholder: "0.0",
    step: "0.1",
    type: "number",
  },
  {
    key: "bagging_fraction",
    label: lang.components["dialog-model-advanced"].bagging_fraction.label,
    description:
      lang.components["dialog-model-advanced"].bagging_fraction.description,
    placeholder: "0.0",
    step: "0.1",
    type: "number",
  },
  {
    key: "bagging_freq",
    label: lang.components["dialog-model-advanced"].bagging_freq.label,
    description:
      lang.components["dialog-model-advanced"].bagging_freq.description,
    placeholder: "0",
    step: "1",
    type: "number",
  },
  {
    key: "min_data_in_leaf",
    label: lang.components["dialog-model-advanced"].min_data_in_leaf.label,
    description:
      lang.components["dialog-model-advanced"].min_data_in_leaf.description,
    placeholder: "0",
    type: "number",
    category: "hidden",
  },

];

export const DEFAULT_CATEGORY_FIELDS = FIELDS.filter(
  (field) => field.category === undefined,
);
