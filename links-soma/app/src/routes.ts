export const ROUTES = {
  HOME: "/",
  JOB: {
    ROOT: "/job",
    DETAIL: (id: string) => `/job/detail/${id}`,
    PREVIEW: (id: string) => `/job/preview/${id}`,
    DETAIL_ML: (id: string) => `/job/detail/${id}/ml`,
    DETAIL_PREPROCESS: (id: string) => `/job/detail/${id}/preprocess`,
    DETAIL_EXPORT: (id: string) => `/job/detail/${id}/export`,
    DETAIL_RESULT: (id: string) => `/job/detail/${id}/result`,
  },
  ANALYSIS: {
    WORKBOOK: "/analysis/workbook",
    WORKBOOK_DETAIL: (id: string) => `/analysis/workbook/${id}`,
    WORKBOOK_EDIT: ({
      id,
      queryParams,
    }: {
      id: string | number;
      queryParams?: {
        sheetId?: string | number | null;
        viewId?: string | number | null;
      };
    }) => {
      const query = new URLSearchParams();
      const base = `/analysis/workbook/${id}/edit`;
      if (!queryParams) {
        return base;
      }
      if (queryParams.sheetId) {
        query.set("sheetId", String(queryParams.sheetId));
      }
      if (queryParams.viewId) {
        query.set("viewId", String(queryParams.viewId));
      }
      return `/analysis/workbook/${id}/edit?${query.toString()}`;
    },
  },
  DATASET: "/dataset",
  MODEL: {
    ROOT: "/model",
    CREATE: "/model/create",
    RECREATE: (id: string) => `/model/create/${id}`,
  },
  NORMALIZATION: {
    ROOT: "/normalization",
    CREATE: "/normalization/create",
    RECREATE: (id: string) => `/normalization/create/${id}`,
  },
  EVALUATION: {
    ROOT: "/evaluation",
    CREATE: "/evaluation/create",
  },
  DEBUG: "/debug",
} as const;

export const withHash = (path: string): string => `#${path}`;
