import { useForm, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

/** https://www.notion.so/eukarya/Python-40f49a4c1a3b498486dd0e13aaad5a4a */
export const schema = z.object({
  settings: z.object({
    // 設定値の変更
    reference_data: z.enum(["resident_registry"]),
    reference_date: z.string(),
    advanced: z.object({
      similarity_threshold: z.coerce.number().default(0.95),
      n_gram_size: z.number().default(2),
      joining_method: z
        .enum(["intersection", "nearest"])
        .default("intersection"),
    }),
  }),
  data: z.object({
    resident_registry: z.object({
      id: z.number(),
      path: z.string(),
      columns: z.object({
        household_code: z.string(),
        gender: z.string(),
        address: z.string(),
        birth_date: z.string(),
        resident_date: z.string(),
      }),
    }),
    water_status: z.object({
      id: z.number(),
      path: z.string(),
      columns: z.object({
        water_supply_number: z.string(),
        water_disconnection_date: z.string(),
        water_connection_date: z.string(),
        water_disconnection_flag: z.string(),
        address: z.string(),
      }),
    }),
    water_usage: z.object({
      id: z.number(),
      path: z.string(),
      columns: z.object({
        water_supply_number: z.string(),
        water_usage: z.string(),
        water_recorded_date: z.string(),
      }),
    }),
    land_registry: z.object({
      id: z.number(),
      path: z.string(),
      columns: z.object({
        address: z.string(),
        structure_name: z.string(),
        registration_date: z.string(),
      }),
    }),
    vacant_house: z.object({
      id: z.number(),
      path: z.string(),
      columns: z.object({
        address: z.string(),
      }),
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
      columns: z.object({
        geometry: z.string(),
      }),
      input_file_type: z.enum(["csv", "geopackage", "shapefile"]),
      data_type: z.enum(["plateau", "house_condition_report"]),
    }),
    census: z.object({
      id: z.number(),
      path: z.string(),
    }),
  }),
});
export type FormNormalizationType = z.infer<typeof schema>;

export const useFormNormalization = ({
  defaultValues,
}: {
  defaultValues?: FormNormalizationType;
}): UseFormReturn<FormNormalizationType> => {
  return useForm<FormNormalizationType>({
    defaultValues: defaultValues ?? {
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
    },
    resolver: zodResolver(schema),
  });
};
