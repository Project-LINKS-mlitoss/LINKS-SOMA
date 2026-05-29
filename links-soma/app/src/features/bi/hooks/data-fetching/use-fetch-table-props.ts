import { useCallback, useEffect, useState } from "react";
import { type TableProps } from "../../types/models/charts";
import {
  usePagination,
  type UsePaginationReturnType,
} from "../../../../shared/hooks/use-pagination";
import { type MapWithTableView, type TableView } from "../../types/models/view";
import {
  type SelectDataSetDetailArea,
  type SelectDataSetDetailBuilding,
} from "../../../../db/schema";
import { type OrderByQuery } from "../../../../shared/types/query";
import { rendererLogger } from "../../../../shared/utils/renderer-logger";

type Params = {
  view: TableView | MapWithTableView;
  orderBy?: OrderByQuery<
    keyof SelectDataSetDetailArea | keyof SelectDataSetDetailBuilding
  > | null;
  selectedDate?: string;
};

type ReturnType = {
  tableProps: TableProps;
  refetch: () => Promise<void>;
  pagination: UsePaginationReturnType;
};

export const useFetchTableProps = ({
  view,
  orderBy,
  selectedDate,
}: Params): ReturnType => {
  const [tableProps, setTableProps] = useState<TableProps>({
    columns: [],
    data: [],
    totalCount: 0,
    allCount: 0,
  });

  const pagination = usePagination({
    total: tableProps.totalCount,
    perPage: 100,
  });

  const fetch = useCallback(async (): Promise<void> => {
    const result = await window.ipcRenderer.invoke("filterDataSetForTable", {
      view,
      pagination: {
        limit: pagination.limitPerPage,
        offset: pagination.limitPerPage * (pagination.page - 1),
      },
      orderBy: orderBy ?? undefined,
      selectedDate,
    });
    setTableProps(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- orderByを追加すると無限ループになるため、JSON.stringifyで比較する
  }, [
    // eslint-disable-next-line react-hooks/exhaustive-deps -- orderByを追加すると無限ループになるため、JSON.stringifyで比較する
    JSON.stringify(orderBy),
    view,
    pagination.limitPerPage,
    pagination.page,
    selectedDate,
  ]);

  useEffect(() => {
    fetch().catch((error) => {
      rendererLogger.error("Table data fetch failed", error, {
        component: "useFetchTableProps",
      });
    });
  }, [fetch]);

  return {
    tableProps,
    refetch: fetch,
    pagination,
  };
};
