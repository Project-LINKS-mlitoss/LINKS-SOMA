import { useForm, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

export const schema = z.object({
  settings: z.object({
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
      path: z.string(),
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
      path: z.string(),
      columns: z.object({
        water_supply_number: z.string(),
        water_disconnection_date: z.string(),
        water_connection_date: z.string(),
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
    census: z.object({
      id: z.number(),
      path: z.string(),
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

export const useFormNormalization = ({
  defaultValues,
}: {
  defaultValues?: FormNormalizationType;
}): UseFormReturn<FormNormalizationType> => {
  return useForm<FormNormalizationType>({
    defaultValues: defaultValues ?? {
      settings: {
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
        census: { id: 0, path: "" },
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
    resolver: zodResolver(schema),
  });
};
