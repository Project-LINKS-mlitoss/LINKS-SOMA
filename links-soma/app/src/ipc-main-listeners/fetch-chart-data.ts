import { type IpcMainInvokeEvent } from "electron";
import { fetchAreaBarChartData } from "../bi-modules/api/fetch-area-bar-chart-data";
import { type View } from "../bi-modules/interfaces/view";
import { fetchBuildingLineChartData } from "../bi-modules/api/fetch-building-line-chart-data";
import { fetchBuildingPieChartData } from "../bi-modules/api/fetch-building-pie-chart-data";
import { type ChartProps } from "../@types/charts";
import { type IpcMainListener } from ".";

type Params = {
  view: View;
  pagination: {
    limit: number;
    offset: number;
  };
};

export const fetchChartData = (async (
  _event: IpcMainInvokeEvent,
  { view, pagination }: Params,
): Promise<ChartProps> => {
  switch (true) {
    case view.style === "bar" && view.unit === "area":
      return await fetchAreaBarChartData({ view, pagination });
    case view.style === "line" && view.unit === "building":
      return await fetchBuildingLineChartData({ view, pagination });
    case view.style === "pie" && view.unit === "building":
      return await fetchBuildingPieChartData({ view, pagination });
    default:
      throw new Error(`style: ${view.style} は未対応です`);
  }
}) satisfies IpcMainListener;
