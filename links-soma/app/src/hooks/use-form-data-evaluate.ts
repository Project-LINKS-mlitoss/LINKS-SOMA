import { useForm, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

export const schema = z.object({
  model_path: z.string(),
  normalized_dataset_paths: z.array(z.string()),
  settings: z.object({
    threshold: z.number(),
  }),
  area_grouping: z.object({
    path: z.string(),
    columns: z.object({
      area_group_id: z.string(),
      area_group_name: z.string(),
    }),
  }),
});

type FormType = z.infer<typeof schema>;

export const useFormDataEvaluation = (): UseFormReturn<FormType> => {
  return useForm<FormType>({
    resolver: zodResolver(schema),
    defaultValues: {
      model_path: "",
      normalized_dataset_paths: [],
      settings: {
        threshold: 0.3,
      },
      area_grouping: {
        path: "",
        columns: {
          area_group_id: "",
          area_group_name: "",
        },
      },
    },
  });
};
