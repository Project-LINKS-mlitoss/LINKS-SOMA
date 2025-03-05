import { createHashRouter, Navigate, RouterProvider } from "react-router-dom";
import {
  FluentProvider,
  createLightTheme,
  type BrandVariants,
} from "@fluentui/react-components";
import { NotFound } from "../components/not-found";
import { Error } from "./error";
import { Debug } from "./debug";
import { NormalizationCreate } from "./normalization/create";
import { Layout } from "./layout";
import "../styles/global.css";
import { Workbook } from "./analysis/workbook";
import { EditWorkbook } from "./analysis/workbook/edit";
import { DetailWorkbook } from "./analysis/workbook/detail";
import { Dataset } from "./dataset";
import { LayoutWithoutPadding } from "./layoutWithoutPadding";
import { Model } from "./model";
import { Job } from "./job";
import { PreprocessDetail } from "./job/detail/preprocess";
import { ModelCreate } from "./model/create";
import { JobPreview } from "./job/detail/preview";
import { JobEvaluationCreate } from "./evaluation/create";
import { MlDetail } from "./job/detail/ml";
import { Normalization } from "./normalization";
import { JobEvaluation } from "./evaluation";
import { ExportDetail } from "./job/detail/export";
import { ResultDetail } from "./job/detail/result";

// クライアントだけで動作するアプリケーションのため`createHashRouter`を使用する
const router = createHashRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <Error />,
    children: [
      {
        path: "/",
        element: <Navigate to="analysis/workbook" />,
      },
      {
        path: "*",
        element: <NotFound />,
      },
      {
        path: "evaluation",
        element: <JobEvaluation />,
      },
      {
        path: "model",
        element: <Model />,
      },
      {
        path: "job",
        element: <Job />,
      },
      {
        path: "job/detail/:id",
        children: [
          {
            path: "ml",
            element: <MlDetail />,
          },
          {
            path: "preprocess",
            element: <PreprocessDetail />,
          },
          {
            path: "export",
            element: <ExportDetail />,
          },
          {
            path: "result",
            element: <ResultDetail />,
          },
        ],
      },
      {
        path: "job/preview/:id",
        element: <JobPreview />,
      },
      {
        path: "analysis/workbook",
        element: <Workbook />,
        index: true,
      },
      {
        path: "analysis/workbook/:id",
        element: <DetailWorkbook />,
      },
      {
        path: "dataset",
        element: <Dataset />,
      },
      {
        path: "debug",
        element: <Debug />,
      },
      {
        path: "model/create",
        element: <ModelCreate />,
      },
      {
        path: "model/create/:id",
        element: <ModelCreate />,
      },
      {
        path: "normalization",
        element: <Normalization />,
      },
      {
        path: "evaluation/create",
        element: <JobEvaluationCreate />,
      },
    ],
  },
  {
    path: "/",
    element: <LayoutWithoutPadding />,
    errorElement: <Error />,
    children: [
      {
        path: "analysis/workbook/:id/edit",
        element: <EditWorkbook />,
      },
      {
        path: "normalization/create",
        element: <NormalizationCreate />,
      },
      {
        path: "normalization/create/:id",
        element: <NormalizationCreate />,
      },
    ],
  },
]);

const myNewTheme: BrandVariants = {
  10: "#020204",
  20: "#16151E",
  30: "#232235",
  40: "#2D2D48",
  50: "#39395B",
  60: "#444570",
  70: "#505185",
  80: "#5B5D9B",
  90: "#696AAB",
  100: "#7979B4",
  110: "#8887BD",
  120: "#9796C5",
  130: "#A7A5CE",
  140: "#B6B4D7",
  150: "#C6C4DF",
  160: "#D5D4E8",
};

const theme = createLightTheme(myNewTheme);

export function App(): JSX.Element {
  return (
    <FluentProvider theme={theme}>
      <RouterProvider router={router} />
    </FluentProvider>
  );
}
