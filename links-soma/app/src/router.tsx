import { createHashRouter, Navigate } from "react-router-dom";
import { NotFound } from "./shared/components/not-found";
import { Layout } from "./shared/layouts/layout";
import { LayoutWithoutPadding } from "./shared/layouts/layout-without-padding";
import { Error } from "./shared/layouts/error";
import { AppInfoPage as AppInfo } from "./features/app-info/components/app-info-page";
import { JobEvaluationCreate } from "./features/evaluation/pages/create";
import { JobEvaluation } from "./features/evaluation/pages";
import { Model } from "./features/model/pages";
import { ModelCreate } from "./features/model/pages/create";
import { Job } from "./features/job/pages";
import { ExportDetail } from "./features/job/pages/detail/export";
import { MlDetail } from "./features/job/pages/detail/ml";
import { PreprocessDetail } from "./features/job/pages/detail/preprocess";
import { JobPreview } from "./features/job/pages/detail/preview";
import { ResultDetail } from "./features/job/pages/detail/result";
import { Normalization } from "./features/normalization/pages";
import { NormalizationCreate } from "./features/normalization/pages/create";
import { Workbook } from "./features/workbook/pages";
import { EditWorkbook } from "./features/workbook/pages/edit";
import { DetailWorkbook } from "./features/workbook/pages/detail";
import { Dataset } from "./features/dataset/pages";

// クライアントだけで動作するアプリケーションのため`createHashRouter`を使用する
export const router = createHashRouter([
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
        path: "app-info",
        element: <AppInfo />,
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
      {
        path: "evaluation/create",
        element: <JobEvaluationCreate />,
      },
    ],
  },
]);
