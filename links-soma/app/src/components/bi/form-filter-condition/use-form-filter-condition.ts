import { z } from "zod";
import {
  useFieldArray,
  type UseFieldArrayReturn,
  useForm,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { filterConditionSchema } from "../../../bi-modules/schema/parameter";

const FormFilterConditionSchema = z.object({
  filterCondition: z.array(filterConditionSchema),
});
export type FormFilterConditionType = z.infer<typeof FormFilterConditionSchema>;

type Params = {
  init: FormFilterConditionType;
};

type ReturnType = {
  form: UseFormReturn<FormFilterConditionType>;
  fieldState: UseFieldArrayReturn<FormFilterConditionType>;
};
export const useFormFilterCondition = ({ init }: Params): ReturnType => {
  const form = useForm<FormFilterConditionType>({
    defaultValues: init,
    resolver: zodResolver(FormFilterConditionSchema),
  });
  const { control } = form;
  const fieldState = useFieldArray({
    control,
    name: "filterCondition",
  });

  return { form, fieldState };
};
