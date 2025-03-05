export const columnLabels = [
  "世帯番号カラム",
  "住所カラム",
  "生年月日カラム",
  "性別カラム",
  "住定年月日カラム",
];

export type ColumnLabels = (typeof columnLabels)[number];

export type FormValues = {
  apiToken: string;
  datasetFile: FileList;
  apiType: "aws" | "zenrin";
  columns: {
    [key in ColumnLabels]: string;
  };
};
