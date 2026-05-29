/**
 * クイック選択セクションコンポーネント
 * 他のステップで選択済みのデータセットを再利用するためのUI
 */

import { makeStyles, tokens, Text, Card } from "@fluentui/react-components";
import { DocumentCopy20Regular } from "@fluentui/react-icons";
import { Controller, type UseFormReturn } from "react-hook-form";
import { type FormNormalizationType } from "../../hooks/use-form-normalization";
import { useFetchDatasetWithFilePath } from "../../../dataset/hooks/use-fetch-dataset-with-file-path";
import { useFetchDatasetColumns } from "../../../dataset/hooks/use-fetch-dataset-columns";

const useStyles = makeStyles({
  section: {
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
  buttons: {
    display: "flex",
    gap: tokens.spacingHorizontalM,
    flexWrap: "wrap",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingVerticalS,
    cursor: "pointer",
    minWidth: "180px",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  label: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  fileName: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorBrandForeground1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fileNameLoading: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    fontStyle: "italic",
  },
});

type Props = {
  form: UseFormReturn<FormNormalizationType>;
};

/**
 * クイック選択セクション
 * building_type_determination ステップでのみ使用
 */
export const QuickSelectSection = ({ form }: Props): JSX.Element | null => {
  const styles = useStyles();

  // 他ステップのデータを監視
  const buildingRegistryData = form.watch("data.building_registry");
  const buildingPolygonData = form.watch("data.building_polygon");

  // ファイル名を取得（DBから元のファイル名を取得）
  const { data: registryDataset, isLoading: isRegistryLoading } =
    useFetchDatasetWithFilePath({
      type: "raw",
      filePath: buildingRegistryData?.path,
    });
  const { data: polygonDataset, isLoading: isPolygonLoading } =
    useFetchDatasetWithFilePath({
      type: "raw",
      filePath: buildingPolygonData?.path,
    });

  // 建物ポリゴンのカラム一覧を取得（PLATEAUプリセット判定用）
  const { data: polygonColumns } = useFetchDatasetColumns({
    filename: buildingPolygonData?.path ?? "",
  });

  // クイック選択オプションの生成
  const quickSelectOptions = [
    {
      key: "building_registry",
      label: "登記情報と同じ",
      data: buildingRegistryData,
      fileName: registryDataset?.file_name,
      isLoading: isRegistryLoading,
    },
    {
      key: "building_polygon",
      label: "建物ポリゴンと同じ",
      data: buildingPolygonData,
      fileName: polygonDataset?.file_name,
      isLoading: isPolygonLoading,
    },
  ].filter((opt) => opt.data?.path);

  // 選択可能なオプションがない場合は非表示
  if (quickSelectOptions.length === 0) {
    return null;
  }

  // building_type_determination のデータ型
  type BuildingTypeDeterminationData =
    FormNormalizationType["data"]["building_type_determination"];

  // PLATEAUデータかつusageカラムが存在するかを判定
  const isPlateau = buildingPolygonData?.data_type === "plateau";
  const hasUsageColumn = polygonColumns?.includes("usage") ?? false;

  // クイック選択でデータをコピー
  const handleQuickSelect = (
    sourceKey: string,
    sourceData: { id: number; path: string } | undefined,
    onChange: (value: BuildingTypeDeterminationData) => void,
  ): void => {
    if (!sourceData) return;

    // 登記情報選択時: 住所カラムをコピー
    if (sourceKey === "building_registry") {
      onChange({
        id: sourceData.id,
        path: sourceData.path,
        columns: {
          address: buildingRegistryData?.columns?.address ?? "",
          building_type: "",
        },
        input_file_type: "csv",
        residential_values: [],
      });
      return;
    }

    // 建物ポリゴン選択時: ファイル形式をコピー、PLATEAUでusageカラムがあればプリセット
    if (sourceKey === "building_polygon") {
      const shouldPresetUsage = isPlateau && hasUsageColumn;
      onChange({
        id: sourceData.id,
        path: sourceData.path,
        columns: {
          address: "",
          building_type: shouldPresetUsage ? "usage" : "",
        },
        input_file_type: buildingPolygonData?.input_file_type ?? "geopackage",
        residential_values: [],
      });
      return;
    }
  };

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <DocumentCopy20Regular />
        <Text>他のステップで選択済みのデータを使用</Text>
      </div>
      <div className={styles.buttons}>
        <Controller
          control={form.control}
          name="data.building_type_determination"
          render={({ field: { onChange } }) => (
            <>
              {quickSelectOptions.map((option) => (
                <Card
                  key={option.key}
                  className={styles.card}
                  onClick={() =>
                    handleQuickSelect(option.key, option.data, onChange)
                  }
                >
                  <Text className={styles.label}>{option.label}</Text>
                  {option.isLoading ? (
                    <Text className={styles.fileNameLoading}>
                      読み込み中...
                    </Text>
                  ) : (
                    <Text className={styles.fileName}>{option.fileName}</Text>
                  )}
                </Card>
              ))}
            </>
          )}
        />
      </div>
    </div>
  );
};
