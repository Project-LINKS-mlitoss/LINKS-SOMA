import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { editViewFormSchema } from "../schema/edit-view-form";
import { useFetchResultViews } from "../../hooks/use-fetch-result-views";
import { type EditViewFormType } from "../interfaces/edit-view-form";
import { type SelectResultSheet, type SelectResultView } from "../../schema";
import { useFetchResultView } from "../../hooks/use-fetch-result-view";
import { toFloat } from "../util/toFloat";
import { submittedEditViewFormAtom } from "../../state/submitted-edit-view-form-atom";

type Params = {
  defaultValues: EditViewFormType;
  selectedResultSheetId: SelectResultSheet["id"] | undefined;
  selectedResultViewId: SelectResultView["id"] | undefined;
};

type ReturnType = {
  form: UseFormReturn<EditViewFormType>;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  selectedResultView: SelectResultView | undefined;
};

export const useEditViewForm = ({
  defaultValues,
  selectedResultSheetId,
  selectedResultViewId,
}: Params): ReturnType => {
  const form = useForm<EditViewFormType>({
    resolver: zodResolver(editViewFormSchema),
    defaultValues,
  });

  const setSubmittedEditViewFormState = useSetAtom(submittedEditViewFormAtom);

  const { mutate: mutateResultViews } = useFetchResultViews({
    sheetId: selectedResultSheetId,
  });
  const { data: selectedResultView, mutate: mutateResultView } =
    useFetchResultView({
      resultViewId: selectedResultViewId,
    });

  useEffect(
    function resetForm() {
      const parameters = defaultValues.parameters;
      const yearParameter = parameters.find(
        (parameter) => parameter.key === "year",
      );
      if (!yearParameter) {
        parameters.push({
          key: "year",
          type: "filter",
          value: {
            start: "",
            end: "",
          },
        });
      }
      form.reset({
        ...defaultValues,
        parameters,
      });
    },
    [defaultValues, form, selectedResultViewId],
  );

  const onSubmit = form.handleSubmit(async (data) => {
    if (!selectedResultViewId) return;

    const value = {
      data_set_result_id: data.dataSetResultId,
      ...data,
      parameters: toFloat(data.parameters),
    };

    await window.ipcRenderer.invoke("updateResultViews", {
      resultViewId: selectedResultViewId,
      value,
    });

    void mutateResultView();
    void mutateResultViews();

    setSubmittedEditViewFormState(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    setSubmittedEditViewFormState(false);
  });

  return { form, onSubmit, selectedResultView };
};
