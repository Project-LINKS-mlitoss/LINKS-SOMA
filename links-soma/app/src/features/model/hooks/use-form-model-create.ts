import { useForm, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  DEFAULT_EXPLANATORY_COLUMNS,
  FIXED_MODEL_ADVANCED,
} from "../constants";
import { lang } from "../../../shared/config/lang";

const validation = lang.pages["model/create"].validation;

export const schema = z.object({
  // 未選択時は空文字を渡すため required_error では足りず、.min(1) で直接弾く。
  input_path: z.string().min(1, validation.datasetRequired),
  settings: z.object({
    explanatory_variables: z
      .array(z.string())
      .min(1, validation.explanatoryVariablesRequired),
    // IF002 へ渡すハイパーパラメータ。値はユーザー入力ではなく FIXED_MODEL_ADVANCED 固定
    advanced: z.object({
      test_size: z.coerce.number().optional(),
      n_splits: z.coerce.number().optional(),
      undersample: z.boolean().optional(),
      undersample_ratio: z.coerce.number().optional(),
      threshold: z.coerce.number().optional(),
      hyperparameter_flag: z.coerce.boolean().optional(),
      n_trials: z.coerce.number().optional(),
      lambda_l1: z.coerce.number().optional(),
      lambda_l2: z.coerce.number().optional(),
      num_leaves: z.coerce.number().optional(),
      feature_fraction: z.coerce.number().optional(),
      bagging_fraction: z.coerce.number().optional(),
      bagging_freq: z.coerce.number().optional(),
      min_data_in_leaf: z.coerce.number().optional(),
    }),
  }),
});
type FormType = z.infer<typeof schema>;

/**
 * @deprecated `DEFAULT_EXPLANATORY_COLUMNS` を使用してください（`../constants` からインポート）
 */
export const DEFAULT_SELECTED_COLUMNS = [...DEFAULT_EXPLANATORY_COLUMNS];

export const useFormModelCreate = (): UseFormReturn<FormType> => {
  return useForm<FormType>({
    defaultValues: {
      settings: {
        explanatory_variables: [],
        advanced: FIXED_MODEL_ADVANCED,
      },
    },
    resolver: zodResolver(schema),
  });
};
