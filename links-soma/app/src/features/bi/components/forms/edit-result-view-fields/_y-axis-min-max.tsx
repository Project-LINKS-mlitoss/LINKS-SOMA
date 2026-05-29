import { useFormContext, type UseFormReturn } from "react-hook-form";
import { useEffect, useState } from "react";
import { type EditViewFormType } from "../../../types/models/form";
import { Field, Input } from "../../../../../shared/components/ui";

export const YAxisMaxField = (): JSX.Element => {
  const form = useFormContext<EditViewFormType>();
  const { yAxisMinMax, handleChange } = _useYAxisMinMaxFields(form);

  return (
    <Field label="Y軸の最大値">
      <Input
        onChange={handleChange("max")}
        placeholder="最大値"
        style={{ width: "12ch" }}
        type="number"
        value={yAxisMinMax?.max !== null ? yAxisMinMax.max.toString() : ""}
      />
    </Field>
  );
};

/**
 * カスタムフックの定義
 */
type HooksReturnType = {
  yAxisMinMax: { min: number | null; max: number | null };
  handleChange: (
    target: "min" | "max",
  ) => (e: React.ChangeEvent<HTMLInputElement>) => void;
};

const _useYAxisMinMaxFields = ({
  getValues,
  setValue,
}: UseFormReturn<EditViewFormType>): HooksReturnType => {
  const [yAxisMinMax, setYAxisMinMax] = useState<{
    min: number | null;
    max: number | null;
  }>({ min: null, max: null });

  useEffect(() => {
    const currentYAxisMinMax = getValues("parameters").find(
      (p) => p.key === "yAxisMinMax",
    );
    if (currentYAxisMinMax) {
      setYAxisMinMax(currentYAxisMinMax.value);
    }
  }, [getValues]);

  const handleChange =
    (target: "min" | "max") =>
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const currentYAxisMinMax = getValues("parameters").find(
        (p) => p.key === "yAxisMinMax",
      );

      /** 既存のyAxisMinMaxがある場合は更新、ない場合は新規作成 */
      if (currentYAxisMinMax) {
        setYAxisMinMax({
          ...currentYAxisMinMax.value,
          [target]: e.target.value !== "" ? Number(e.target.value) : null,
        });
        setValue("parameters", [
          ...getValues("parameters").filter((p) => p.key !== "yAxisMinMax"),
          {
            key: "yAxisMinMax",
            type: "yAxisMinMax",
            value: {
              ...currentYAxisMinMax.value,
              [target]: e.target.value !== "" ? Number(e.target.value) : null,
            },
          },
        ]);
      } else {
        setYAxisMinMax((prev) => ({
          ...prev,
          [target]: e.target.value !== "" ? Number(e.target.value) : null,
        }));
        setValue("parameters", [
          ...getValues("parameters"),
          {
            key: "yAxisMinMax",
            type: "yAxisMinMax",
            value: {
              ...yAxisMinMax,
              [target]: e.target.value !== "" ? Number(e.target.value) : null,
            },
          },
        ]);
      }
    };

  return {
    yAxisMinMax,
    handleChange,
  };
};
