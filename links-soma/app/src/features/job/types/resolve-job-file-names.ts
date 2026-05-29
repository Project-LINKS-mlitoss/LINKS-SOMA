export type ResolveJobFileNamesRequest = {
  rawPaths?: string[];
  normalizedPaths?: string[];
  modelPath?: string;
  dataSetResultId?: number;
  viewId?: number;
};

export type ResolveJobFileNamesResponse = {
  rawNames: Record<string, string | null>;
  normalizedNames: Record<string, string | null>;
  modelName: string | null;
  dataSetResultTitle: string | null;
  viewTitle: string | null;
  viewRoute: {
    workbookId: number;
    sheetId: number;
    viewId: number;
  } | null;
};
