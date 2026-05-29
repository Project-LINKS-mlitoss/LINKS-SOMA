import {
  type SortDirection,
  type TableColumnId,
  useTableFeatures,
  useTableSort,
} from "@fluentui/react-components";
import { type OrderByQuery } from "../types/query";

type HeaderSortProps = (columnId: TableColumnId) => {
  onClick: (e: React.MouseEvent) => void;
  sortDirection: SortDirection | undefined;
};

type UseSortReturnType<T> = {
  headerSortProps: HeaderSortProps;
  orderBy: OrderByQuery<T> | null;
};

/**
 * fluentuiのuseTableSortをラップして、ソート機能を提供するカスタムフック
 */
export const useSort = <T>(): UseSortReturnType<T> => {
  const {
    sort: { getSortDirection, toggleColumnSort, sortColumn, sortDirection },
  } = useTableFeatures<T>(
    {
      columns: [],
      items: [],
    },
    [useTableSort({})],
  );

  const headerSortProps: HeaderSortProps = (columnId) => ({
    onClick: (e) => {
      toggleColumnSort(e, columnId);
    },
    sortDirection: getSortDirection(columnId),
  });

  const orderBy = sortColumn
    ? {
        column: sortColumn as T,
        direction: sortDirection,
      }
    : null;

  return {
    headerSortProps,
    orderBy,
  };
};
