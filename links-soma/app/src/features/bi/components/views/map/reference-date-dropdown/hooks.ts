import { useEffect, useState } from "react";
import { useFetchReferenceDates } from "../../../../../../shared/hooks/use-fetch-reference-dates";

type Params = {
  dataSetResultId: number;
};

export type ReferenceDateDropdownReturn = {
  selectedDate: string | undefined;
  setSelectedDate: (date: string | undefined) => void;
  referenceDates: string[] | undefined;
};

export const useReferenceDateDropdown = ({
  dataSetResultId,
}: Params): ReferenceDateDropdownReturn => {
  const { data: referenceDates } = useFetchReferenceDates({
    dataSetResultId,
  });
  const [selectedDate, setSelectedDate] = useState<string | undefined>(
    referenceDates?.[0],
  );

  useEffect(
    function fetchReferenceDatesEffect() {
      if (!referenceDates) return;
      setSelectedDate(
        (prevSelectedDate) => prevSelectedDate || referenceDates[0],
      );
    },
    [referenceDates],
  );

  return {
    selectedDate,
    setSelectedDate,
    referenceDates,
  };
};
