import { useForm, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { lang } from "../../../shared/config/lang";

// 必須データセット（住基/水道開閉栓/水道使用量）はファイル未選択で送信を止める。
// 任意データセットの path は空（未選択）を許す＝止めない。
const requiredFilePath = z
  .string()
  .min(1, lang.components["form-normalization"].validation.datasetRequired);

/** 名寄せの目的。空き家推定 / AIモデル構築。 */
export const NORMALIZATION_PURPOSES = [
  "vacancy_estimation",
  "model_training",
] as const;
export type NormalizationPurpose = (typeof NORMALIZATION_PURPOSES)[number];

export const schema = z.object({
  settings: z.object({
    purpose: z.enum(NORMALIZATION_PURPOSES).default("vacancy_estimation"),
    reference_date: z.string(),
    municipality: z.string().trim().min(1),
    advanced: z.object({
      joining_method: z
        .enum(["intersection", "nearest"])
        .default("intersection"),
    }),
  }),
  data: z.object({
    resident_registry: z.object({
      id: z.number(),
      path: requiredFilePath,
      columns: z.object({
        household_code: z.string(),
        address: z.string(),
        birth_date: z.string(),
        resident_date: z.string(),
        reason_transfer: z.string(),
        date_transfer: z.string(),
      }),
    }),
    water_status: z.object({
      id: z.number(),
      path: requiredFilePath,
      columns: z.object({
        water_supply_number: z.string(),
        water_disconnection_date: z.string(),
        water_connection_date: z.string(),
        address: z.string(),
      }),
    }),
    water_usage: z.object({
      id: z.number(),
      path: requiredFilePath,
      columns: z.object({
        water_supply_number: z.string(),
        water_usage: z.string(),
        water_recorded_date: z.string(),
      }),
    }),
    building_registry: z.object({
      id: z.number(),
      path: z.string(),
      columns: z.object({
        address: z.string(),
        structure_name: z.string(),
        registration_reason: z.string(), //登記情報
        registration_date: z.string(), //登記日付
      }),
    }),
    building_type_determination: z.object({
      id: z.number(),
      path: z.string(),
      input_file_type: z.enum(["csv", "geopackage", "shapefile"]),
      columns: z.object({
        address: z.string(), // 住所  if csv file
        building_type: z.string(), // 家屋種別
      }),
      residential_values: z.array(z.string()).default([]), // 住宅地の値
    }),
    geocoding: z.object({
      id: z.number(),
      path: z.string(),
      columns: z.object({
        address: z.string(),
        latitude: z.string(),
        longitude: z.string(),
      }),
    }),
    building_polygon: z.object({
      id: z.number(),
      path: z.string(),
      input_file_type: z.enum(["geopackage", "shapefile"]),
      data_type: z.enum(["plateau", "others"]),
    }),
    vacant_house: z.object({
      id: z.number(),
      path: z.string(),
      columns: z.object({
        address: z.string(),
      }),
    }),
    optional_data_source: z.object({
      id: z.number(),
      path: z.string(),
      columns: z.object({
        address: z.string(),
      }),
    }),
  }),
});
export type FormNormalizationType = z.infer<typeof schema>;

/**
 * 割り当てが無くても Python が処理を続けられるカラム。ここに無いカラムは要求する。
 *
 * 欠落を許容する契約が Python 側にあるカラムまで要求すると、その列を持たない CSV しか
 * 手元に無い自治体が名寄せを実行できなくなる（画面には割り当てる選択肢が出ないため
 * 解消手段が無い）。要求範囲は Python の契約と一致させる。
 *
 * - household_code: juki.py が `has_hh` ガードで集約キーから外す。
 *   REQUIRED_COLUMNS_BY_DATASET["juki"] からも同じ理由で除かれている
 * - structure_name / registration_date: touki.py が `.get` フォールバックで補う。
 *   REQUIRED_COLUMNS_BY_DATASET["touki"] は address と registration_reason のみ
 */
const OPTIONAL_COLUMNS: Record<string, readonly string[]> = {
  resident_registry: ["household_code"],
  building_registry: ["structure_name", "registration_date"],
};

/**
 * ファイルを選択したデータセットのうち、割り当てが必要なのに済んでいないカラム名を返す。
 *
 * 送信ゲート（formSchema）と確認画面の表示が同じ条件を見るための単一の判定。分けると
 * 「ゲートは弾くが画面は設定済みと表示する」無言ブロックが生まれる。
 *
 * 未割り当てのカラムは param_adapter.py で `""` のまま Python に渡る。water.py の
 * `src_col = {v: k for k, v in cols.items() if v is not None}` は `""` を通すため rename が
 * 空振りし、列が生成されないまま消費側が `df["usage_start_date"]` を叩いて KeyError になる。
 * 捕捉されない KeyError は error_msg を持たないため「不明なエラーが発生しました。」に化ける。
 */
export const getUnassignedColumns = (
  datasetKey: string,
  data: FormNormalizationType["data"],
): string[] => {
  const dataset = data[datasetKey as keyof FormNormalizationType["data"]];
  if (!dataset?.path) return [];
  const columns: Record<string, string> =
    "columns" in dataset ? dataset.columns : {};
  return Object.entries(columns)
    .filter(([, assigned]) => !assigned)
    .filter(([columnKey]) => !isOptionalColumn(datasetKey, columnKey))
    .filter(([columnKey]) => !isDisabledColumn(datasetKey, columnKey, data))
    .map(([columnKey]) => columnKey);
};

const isOptionalColumn = (datasetKey: string, columnKey: string): boolean =>
  OPTIONAL_COLUMNS[datasetKey]?.includes(columnKey) ?? false;

const requireAssignedColumns = (
  data: FormNormalizationType["data"],
  ctx: z.RefinementCtx,
): void => {
  for (const datasetKey of Object.keys(data)) {
    for (const columnKey of getUnassignedColumns(datasetKey, data)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["data", datasetKey, "columns", columnKey],
        message:
          lang.components["form-normalization"].validation.columnRequired,
      });
    }
  }
};

/** 画面上で入力できないカラムは要求しない。要求すると解消手段のない停止になる。 */
const isDisabledColumn = (
  datasetKey: string,
  columnKey: string,
  data: FormNormalizationType["data"],
): boolean =>
  datasetKey === "building_type_determination" &&
  columnKey === "address" &&
  data.building_type_determination.input_file_type !== "csv";

/**
 * 送信ゲートの実体。`schema` は `extractNormalizationDatasetColumns` が shape を走査するため
 * ZodObject のまま保ち、refine はこちらに載せる。
 */
export const formSchema = schema.superRefine((value, ctx) => {
  requireAssignedColumns(value.data, ctx);
});

export const useFormNormalization = ({
  defaultValues,
  initialPurpose,
}: {
  defaultValues?: FormNormalizationType;
  /** 新規開始時の初期目的（モデル構築画面からの導線で指定）。下書き/再実行（defaultValues あり）では無視。 */
  initialPurpose?: NormalizationPurpose;
}): UseFormReturn<FormNormalizationType> => {
  return useForm<FormNormalizationType>({
    defaultValues: defaultValues ?? {
      settings: {
        purpose: initialPurpose ?? "vacancy_estimation",
        reference_date: "2021-01-01",
        municipality: "",
        advanced: {
          joining_method: "intersection",
        },
      },
      data: {
        resident_registry: {
          id: 0,
          path: "",
          columns: {
            household_code: "",
            address: "",
            birth_date: "",
            resident_date: "",
            reason_transfer: "",
            date_transfer: "",
          },
        },
        water_status: {
          id: 0,
          path: "",
          columns: {
            water_supply_number: "",
            water_disconnection_date: "",
            water_connection_date: "",
            address: "",
          },
        },
        water_usage: {
          id: 0,
          path: "",
          columns: {
            water_supply_number: "",
            water_usage: "",
            water_recorded_date: "",
          },
        },
        building_registry: {
          id: 0,
          path: "",
          columns: {
            address: "",
            structure_name: "",
            registration_reason: "",
            registration_date: "",
          },
        },
        building_type_determination: {
          id: 0,
          path: "",
          input_file_type: "csv",
          columns: {
            address: "",
            building_type: "",
          },
        },
        geocoding: {
          id: 0,
          path: "",
          columns: {
            address: "",
            latitude: "",
            longitude: "",
          },
        },
        building_polygon: {
          id: 0,
          path: "",
          input_file_type: "geopackage",
          data_type: "plateau",
        },
        vacant_house: {
          id: 0,
          path: "",
          columns: { address: "" },
        },
        optional_data_source: {
          id: 0,
          path: "",
          columns: { address: "" },
        },
      },
    },
    resolver: zodResolver(formSchema),
  });
};
