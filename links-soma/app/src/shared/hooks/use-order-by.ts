import { useState } from "react";
import { type SortDirection } from "@fluentui/react-components";
import { type OrderByQuery } from "../types/query";

export type UseOrderByReturnType<T> = {
  orderBy: OrderByQuery<T>;
  handleColumnChange: (newColumn: T | null) => void;
};

export const useOrderBy = <T>(initColumn?: T): UseOrderByReturnType<T> => {
  const [column, setColumn] = useState<T | null>(initColumn || null);
  const [direction, setDirection] = useState<SortDirection | null>(null);

  const handleColumnChange = (newColumn: T | null): void => {
    setColumn(newColumn);
    if (newColumn === column) {
      setDirection((prev) =>
        prev === "ascending" ? "descending" : "ascending",
      );
    } else {
      setDirection("ascending");
    }
  };

  return {
    orderBy: {
      column: column ?? (null as unknown as T),
      direction: direction ?? "ascending",
    },
    handleColumnChange,
  };
};
