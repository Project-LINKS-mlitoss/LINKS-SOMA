import { forwardRef } from "react";
import { type View } from "../../types/models/view";
import { type ChartExportHandle } from "../../types/chart-export";
import { ViewBar } from "../views/chart/view-bar";
import { ViewLine } from "../views/chart/view-line";
import { ViewPie } from "../views/chart/view-pie";
import { ViewMapWithTable } from "../views/map/view-map-with-table";
import { ViewTable } from "../views/table/view-table";

type Props = {
  view: View;
  isPreview?: boolean;
};

/** ビューの分岐をするコンポーネント */
export const ViewStyle = forwardRef<ChartExportHandle, Props>(
  ({ view, ...props }, ref) => {
    const { style, unit } = view;

    switch (true) {
      case style === "pie" && unit === "building":
        return <ViewPie ref={ref} view={view} {...props} />;
      case style === "bar" && unit === "area":
        return <ViewBar ref={ref} view={view} {...props} />;
      case style === "line" && unit === "building":
        return <ViewLine ref={ref} view={view} {...props} />;
      case style === "table":
        return <ViewTable view={view} {...props} />;
      case style === "map-with-table":
        return <ViewMapWithTable view={view} {...props} />;
    }

    return <>未設定</>;
  },
);

ViewStyle.displayName = "ViewStyle";
