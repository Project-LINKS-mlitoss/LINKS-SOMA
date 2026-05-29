import { useCallback, useEffect } from "react";
import { useAtomValue } from "jotai";
import { type ChartProps } from "../../types/models/charts";
import { type BarView } from "../../types/models/view";
import { rendererLogger } from "../../../../shared/utils/renderer-logger";
import {
  usePagination,
  type UsePaginationReturnType,
} from "../../../../shared/hooks/use-pagination";
import { useIsLoading } from "../../../../shared/hooks/use-is-loading";
import { submittedEditViewFormAtom } from "../submitted-edit-view-form-atom";
import {
  useOrderBy,
  type UseOrderByReturnType,
} from "../../../../shared/hooks/use-order-by";
import { type SelectDataSetDetailArea } from "../../../../db/schema";
import { useChartProps } from "../use-chart-props";
import { useWorkbookIdsSearchQuery } from "../view-state/use-workbook-ids-search-query";

type Params = {
  view: BarView;
};

type ReturnType = {
  chartProps: ChartProps;
  refetch: () => Promise<void>;
  pagination: UsePaginationReturnType;
  isLoading: boolean;
  useOrderBy: UseOrderByReturnType<keyof SelectDataSetDetailArea>;
};

export const useFetchBarChartProps = ({ view }: Params): ReturnType => {
  const { chartProps, handleChartProps } = useChartProps();
  const { isLoading, handleIsLoading } = useIsLoading({ init: true });

  const pagination = usePagination({
    total: chartProps.totalCount,
    perPage: 100,
  });

  const { orderBy, handleColumnChange } =
    useOrderBy<keyof SelectDataSetDetailArea>("reference_date");

  const { viewId } = useWorkbookIdsSearchQuery();
  const setSubmittedEditViewFormState = useAtomValue(submittedEditViewFormAtom);

  const fetch = useCallback(
    async (value: BarView): Promise<void> => {
      try {
        handleIsLoading(true);
        const result = await window.ipcRenderer.invoke("fetchChartData", {
          view: {
            ...value,
            pagination: {
              limit: pagination.limitPerPage,
              offset: pagination.limitPerPage * (pagination.page - 1),
            },
            orderBy,
          },
        });
        handleChartProps(result);
      } catch (error) {
        rendererLogger.error("Bar chart data fetch failed", error, {
          viewId: value.id,
          component: "useFetchBarChartProps",
        });
      } finally {
        handleIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleIsLoading を追加すると無限ループになるため無視
    [
      pagination.limitPerPage,
      pagination.page,
      handleChartProps,
      orderBy.column,
      orderBy.direction,
    ],
  );

  /** 初期化 */
  useEffect(() => {
    fetch(view).catch((error) => {
      rendererLogger.error("Initial bar chart fetch failed", error, {
        viewId: view.id,
        component: "useFetchBarChartProps",
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- viewの変更を検知すると余計な更新が入るため無視
  }, [fetch]);

  useEffect(() => {
    if (setSubmittedEditViewFormState && Number(viewId) === view.id) {
      fetch(view).catch((error) => {
        rendererLogger.error("Initial bar chart fetch failed", error, {
          viewId: view.id,
          component: "useFetchBarChartProps",
        });
      });
    }
  }, [setSubmittedEditViewFormState, fetch, view, viewId]);

  return {
    chartProps,
    refetch: () => fetch(view),
    pagination,
    isLoading,
    useOrderBy: {
      orderBy,
      handleColumnChange,
    },
  };
};
