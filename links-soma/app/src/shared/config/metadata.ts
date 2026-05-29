import { type result_views } from "../../db/schema";
import { type FormNormalizationType } from "../../features/normalization/hooks/use-form-normalization";
import { translateColumnToJapanese } from "../column-translation-utils";
import { lang } from "./lang";

type ResultViewsStyle = (typeof result_views.style.enumValues)[number];
const RESULT_VIEWS_STYLE: {
  [key in ResultViewsStyle]: string;
} = {
  bar: "棒グラフ",
  line: "折れ線グラフ",
  pie: "円グラフ",
  table: "表",
  "map-with-table": "地図",
};

type ResultViewsUnit = (typeof result_views.unit.enumValues)[number];
const RESULT_VIEWS_UNIT: {
  [key in ResultViewsUnit]: string;
} = {
  building: "建物",
  area: "地域",
};

type NormalizationParameterLabelKey =
  keyof (FormNormalizationType["data"]["resident_registry"]["columns"] &
    FormNormalizationType["data"]["water_status"]["columns"] &
    FormNormalizationType["data"]["water_usage"]["columns"] &
    FormNormalizationType["data"]["building_registry"]["columns"] &
    FormNormalizationType["data"]["building_type_determination"]["columns"] &
    FormNormalizationType["data"]["geocoding"]["columns"] &
    Omit<FormNormalizationType["settings"], "advanced">);

type NormalizationParameterLabel = Record<
  NormalizationParameterLabelKey,
  string
>;

// lang.ts の normalizationParameters へのショートカット
const params = lang.components.normalizationParameters;

const NORMALIZATION_PARAMETER_LABEL: NormalizationParameterLabel = {
  address: params.address.shortLabel,
  household_code: params.household_code.shortLabel,
  birth_date: params.birth_date.shortLabel,
  resident_date: params.resident_date.shortLabel,
  water_supply_number: params.water_supply_number.shortLabel,
  water_disconnection_date: params.water_disconnection_date.shortLabel,
  water_connection_date: params.water_connection_date.shortLabel,
  water_usage: params.water_usage.shortLabel,
  water_recorded_date: params.water_recorded_date.shortLabel,
  structure_name: params.structure_name.shortLabel,
  // reference_date は動的生成を維持
  reference_date: `推定したい日付(${translateColumnToJapanese("reference_date", "building")})`,
  municipality: "推定したい市区町村名",
  registration_reason: params.registration_reason.shortLabel,
  building_type: params.building_type.shortLabel,
  latitude: params.latitude.shortLabel,
  longitude: params.longitude.shortLabel,
  reason_transfer: params.reason_transfer.shortLabel,
  date_transfer: params.date_transfer.shortLabel,
  registration_date: params.registration_date.shortLabel,
};

export const LanguageMap = {
  RESULT_VIEWS_STYLE,
  RESULT_VIEWS_UNIT,
  NORMALIZATION_PARAMETER_LABEL,
};
