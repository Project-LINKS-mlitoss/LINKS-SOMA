import { type z } from "zod";
import { type schema as normalizationSchema } from "../hooks/use-form-normalization";

/**
 * 名寄せ処理で利用するデフォルトのパラメータを作成するだけの関数
 * インラインで書くとコードの見通しが悪くなるため追加
 *
 * @returns デフォルトの名寄せ処理用パラメータ
 */
export const defaultNormalizationParameters: z.infer<
  typeof normalizationSchema
> = {
  settings: {
    reference_data: "resident_registry",
    reference_date: "2021-01-01",
    advanced: {
      similarity_threshold: 0.95,
      n_gram_size: 2,
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
        gender: "",
        resident_date: "",
      },
    },
    water_status: {
      id: 0,
      path: "",
      columns: {
        water_supply_number: "",
        water_disconnection_date: "",
        water_connection_date: "",
        water_disconnection_flag: "",
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
    land_registry: {
      id: 0,
      path: "",
      columns: {
        address: "",
        structure_name: "",
        registration_date: "",
      },
    },
    vacant_house: {
      id: 0,
      path: "",
      columns: {
        address: "",
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
      columns: {
        geometry: "",
      },
      input_file_type: "csv",
      data_type: "plateau",
    },
    census: { id: 0, path: "" },
  },
};
