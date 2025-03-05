import { useCallback, useEffect, useState } from "react";
import { type TableProps } from "../../@types/charts";
import {
  usePagination,
  type UsePaginationReturnType,
} from "../../hooks/use-pagination";
import { type TableView } from "../interfaces/view";

type Params = {
  view: TableView;
};

type ReturnType = {
  tableProps: TableProps;
  refetch: () => Promise<void>;
  pagination: UsePaginationReturnType;
};

export const useFetchTableProps = ({ view }: Params): ReturnType => {
  const pagination = usePagination(100);
  const [tableProps, setTableProps] = useState<TableProps>({
    columns: [],
    data: [],
  });

  const fetch = useCallback(async (): Promise<void> => {
    const result = await window.ipcRenderer.invoke("filterDataSetForTable", {
      view,
      pagination: {
        limit: pagination.limitPerPage,
        offset: pagination.limitPerPage * (pagination.page - 1),
      },
    });
    setTableProps(result);
  }, [pagination.limitPerPage, pagination.page, view]);

  useEffect(() => {
    fetch().catch(console.error);
  }, [fetch]);

  return {
    tableProps,
    refetch: fetch,
    pagination,
  };
};
