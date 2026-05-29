import { useForm, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { DEFAULT_EXPLANATORY_COLUMNS } from "../constants";

export const schema = z.object({
  input_path: z.string({ required_error: "必須" }),
  settings: z.object({
    explanatory_variables: z
      .array(z.string(), { required_error: "必須" })
      .min(1, { message: "必須" }),
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
        advanced: {
          test_size: 0.3,
          n_splits: 3,
          undersample: false,
          undersample_ratio: 3.0,
          threshold: 0.3,
          hyperparameter_flag: false,
          n_trials: 100,
          lambda_l1: 0,
          lambda_l2: 0,
          num_leaves: 31,
          feature_fraction: 1.0,
          bagging_fraction: 1.0,
          bagging_freq: 0,
          min_data_in_leaf: 20,
        },
      },
    },
    resolver: zodResolver(schema),
  });
};
