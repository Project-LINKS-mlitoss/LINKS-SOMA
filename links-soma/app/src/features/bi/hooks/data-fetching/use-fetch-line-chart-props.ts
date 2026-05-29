import { useCallback, useEffect } from "react";
import { useAtomValue } from "jotai";
import { type ChartProps } from "../../types/models/charts";
import { type LineView } from "../../types/models/view";
import { rendererLogger } from "../../../../shared/utils/renderer-logger";
import { useIsLoading } from "../../../../shared/hooks/use-is-loading";
import { submittedEditViewFormAtom } from "../submitted-edit-view-form-atom";
import {
  useOrderBy,
  type UseOrderByReturnType,
} from "../../../../shared/hooks/use-order-by";
import { type SelectDataSetDetailBuilding } from "../../../../db/schema";
import { useChartProps } from "../use-chart-props";
import { useWorkbookIdsSearchQuery } from "../view-state/use-workbook-ids-search-query";

type Params = {
  view: LineView;
};

type ReturnType = {
  chartProps: ChartProps;
  refetch: () => Promise<void>;
  isLoading: boolean;
  useOrderBy: UseOrderByReturnType<keyof SelectDataSetDetailBuilding>;
};

export const useFetchLineChartProps = ({ view }: Params): ReturnType => {
  const { chartProps, handleChartProps } = useChartProps();
  const { isLoading, handleIsLoading } = useIsLoading({ init: true });

  const { orderBy, handleColumnChange } =
    useOrderBy<keyof SelectDataSetDetailBuilding>("reference_date");

  const { viewId } = useWorkbookIdsSearchQuery();
  const setSubmittedEditViewFormState = useAtomValue(submittedEditViewFormAtom);

  const fetch = useCallback(
    async (value: LineView): Promise<void> => {
      try {
        handleIsLoading(true);
        const result = await window.ipcRenderer.invoke("fetchChartData", {
          view: {
            ...value,
            orderBy,
          },
        });

        handleChartProps(result);
      } catch (error) {
        rendererLogger.error("Line chart data fetch failed", error, {
          viewId: value.id,
          component: "useFetchLineChartProps",
        });
      } finally {
        handleIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleIsLoading を追加すると無限ループになるため無視 / view を追加すると余計な更新が入るため無視
    [handleChartProps, orderBy.column, orderBy.direction],
  );

  /** 初期化 */
  useEffect(() => {
    fetch(view).catch((error) => {
      rendererLogger.error("Line chart fetch failed", error, {
        viewId: view.id,
        component: "useFetchLineChartProps",
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- viewの変更を検知すると余計な更新が入るため無視
  }, [fetch]);

  useEffect(() => {
    if (setSubmittedEditViewFormState && Number(viewId) === view.id) {
      fetch(view).catch((error) => {
        rendererLogger.error("Line chart fetch failed", error, {
          viewId: view.id,
          component: "useFetchLineChartProps",
        });
      });
    }
  }, [setSubmittedEditViewFormState, fetch, view, viewId]);

  return {
    chartProps,
    refetch: () => fetch(view),
    isLoading,
    useOrderBy: {
      orderBy,
      handleColumnChange,
    },
  };
};
