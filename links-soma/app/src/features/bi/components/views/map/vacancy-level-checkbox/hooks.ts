import { useState } from "react";
import { type View } from "../../../../types";
import { type VacancyLevel, type VacancyLevels } from "./types";

type Params = {
  unit: View["unit"];
};

export type UseVacancyLevelCheckboxReturn = {
  vacancyLevels: VacancyLevels;
  handleChange: React.ChangeEventHandler<HTMLInputElement>;
  labels: Record<VacancyLevel, string>;
};

export const useVacancyLevelCheckbox = ({
  unit,
}: Params): UseVacancyLevelCheckboxReturn => {
  const [vacancyLevels, setVacancyLevels] = useState<VacancyLevels>({
    low: true,
    medium: true,
    high: true,
  });

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) =>
    setVacancyLevels({
      ...vacancyLevels,
      [event.target.name]: event.target.checked,
    });

  const labels: Record<VacancyLevel, string> =
    unit === "building"
      ? {
          low: "45%未満",
          medium: "45~70%未満",
          high: "70%以上",
        }
      : {
          low: "4%未満",
          medium: "4~11%未満",
          high: "11%以上",
        };

  return {
    vacancyLevels,
    handleChange,
    labels,
  };
};
