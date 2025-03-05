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
    WORKBOOK_EDIT: (id: string) => `/analysis/workbook/${id}/edit`,
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
} as const;

export const withHash = (path: string): string => `#${path}`;
