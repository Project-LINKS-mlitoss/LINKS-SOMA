import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { type JobParameters } from "./@types/job-parameters";
import { type JobTaskResult } from "./@types/job-task-result";
import { type Parameter } from "./bi-modules/interfaces/parameter";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  name: text("name"),
});

export type SelectUser = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const workbooks = sqliteTable("workbooks", {
  id: integer("id").primaryKey(),
  title: text("title"),
  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectWorkbook = typeof workbooks.$inferSelect;
export type InsertWorkbook = typeof workbooks.$inferInsert;

export const result_sheets = sqliteTable("result_sheets", {
  id: integer("id").primaryKey(),
  workbook_id: integer("workbook_id"),
  title: text("title"),
  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectResultSheet = typeof result_sheets.$inferSelect;
export type InsertResultSheet = typeof result_sheets.$inferInsert;

export const result_views = sqliteTable("result_views", {
  id: integer("id").primaryKey(),
  sheet_id: integer("sheet_id"),
  data_set_result_id: integer("data_set_result_id"),

  title: text("title"),
  unit: text("unit", { enum: ["building", "area"] }),
  style: text("style", { enum: ["map", "bar", "line", "pie", "table"] }),

  layoutIndex:
    integer(
      "layoutIndex",
    ) /** レイアウトの順序を制御するための配列インデックスを保持(1~4) */,

  /**
   * チャートの動的カラム対応のためのフィールドをkey-valueのオブジェクト配列で保持するためのカラム
   * SQLiteにはBlobかText型しかなく、DrizzleのレイヤーでObectとして扱わせるために mode;json を指定
   *
   * {
   *  key: string // inputのname属性に対応
   *  value: string // inputのvalue属性に対応
   * }
   */
  parameters: text("parameters", {
    mode: "json",
  })
    .$type<Parameter[]>()
    .notNull(),

  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectResultView = typeof result_views.$inferSelect;
export type InsertResultView = typeof result_views.$inferInsert;

export const data_set_results = sqliteTable("data_set_results", {
  id: integer("id").primaryKey(),
  title: text("title"),
  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectDataSetResult = typeof data_set_results.$inferSelect;
export type InsertDataSetResult = typeof data_set_results.$inferInsert;

export const data_set_detail_buildings = sqliteTable(
  "data_set_detail_buildings",
  {
    id: integer("id").primaryKey(),
    data_set_result_id: integer("data_set_result_id"),

    /**
     * 世帯番号
     *
     * 文字列：任意の文字列
     */
    household_code: text("household_code"),

    /**
     * 正規化住所
     *
     * 文字列：任意の文字列
     */
    normalized_address: text("normalized_address"),

    /**
     * 建物所属地域区分
     *
     * 文字列：町丁目レベルやの地域区分
     */
    area_group: text("area_group"),

    /**
     * 推定日
     *
     * 推定の基準となる日付
     *
     * YYYY-MM-DD形式の文字列
     */
    reference_date: text("reference_date").notNull(),

    /**
     * 世帯人数
     *
     * 0以上の整数
     */
    household_size: integer("household_size"),
    /**
     * 15歳未満の世帯人数
     *
     * 0以上の整数
     */
    members_under_15: integer("members_under_15"),
    /**
     * 15歳未満の世帯に対する人数比
     *
     * 0~1の小数で表現（8byte 浮動小数点）
     */
    percentage_under_15: real("percentage_under_15"),
    /**
     * 15歳以上64歳以下の世帯人数
     *
     * 0以上の整数
     */
    members_15_to_64: integer("members_15_to_64"),
    /**
     * 15歳以上64歳以下の世帯に対する人数比
     *
     * 0~1の小数で表現（8byte 浮動小数点）
     */
    percentage_15_to_64: real("percentage_15_to_64"),
    /**
     * 65歳以上の世帯人数
     *
     * 0以上の整数
     */
    members_over_65: integer("members_over_65"),
    /**
     * 65歳以上の世帯に対する人数比
     *
     * 0~1の小数で表現（8byte 浮動小数点）
     */
    percentage_over_65: real("percentage_over_65"),
    /**
     * 男女比
     *
     * 世帯の男性人数 / 世帯の女性人数 = 0~1の男女比（8byte 浮動小数点）
     */
    gender_ratio: real("gender_ratio"),

    /**
     *  住定期間
     *
     *  整数：住定期間（年）
     */
    residence_duration: integer("residence_duration"),
    /**
     * 水道番号
     *
     * 文字列：任意の文字列
     */
    water_supply_number: text("water_supply_number"),
    /**
     * 閉栓フラグ
     *
     * 1: 閉栓 / 0: 開栓
     */
    water_disconnection_flag: integer("water_disconnection_flag"), // SQLiteにはbool型がないため、0,1で表現する
    /**
     * 最大水道使用量
     *
     * 単位：m^3
     * 小数で表現（8byte 浮動小数点）
     */
    max_water_usage: real("max_water_usage"),
    /**
     * 平均水道使用量
     *
     * 単位：m^3
     * 小数で表現（8byte 浮動小数点）
     */
    avg_water_usage: real("avg_water_usage"),
    /**
     * 合計水道使用量
     *
     * 単位：m^3
     * 小数で表現（8byte 浮動小数点）
     */
    total_water_usage: real("total_water_usage"),
    /**
     * 最小水道使用量
     *
     * 単位：m^3
     * 小数で表現（8byte 浮動小数点）
     */
    min_water_usage: real("min_water_usage"),

    /**
     * 名寄せ元情報_水道
     *
     * 文字列：任意の文字列
     */
    water_supply_source_info: text("water_supply_source_info"),

    /**
     * 登記上の構造名称
     *
     * 文字列：任意の文字列
     */
    structure_name: text("structure_name"),
    /**
     * 登記年月日
     *
     * YYYY-MM-DD形式の文字列
     */
    registration_date: text("registration_date"),
    /**
     * 名寄せ元情報_住基
     *
     * 文字列：任意の文字列
     */
    registration_source_info: text("registration_source_info"),
    /**
     * ID_空き家結果_データクレンジング済
     *
     * 文字列：任意の文字列
     */
    vacant_house_id: text("vacant_house_id"),
    /**
     * 住所_空き家結果_データクレンジング済
     *
     * 文字列：任意の文字列
     */
    vacant_house_address: text("vacant_house_address"),
    vacant_house_longitude: real("vacant_house_longitude"),
    vacant_house_latitude: real("vacant_house_latitude"),
    vacant_house_source_info: text("vacant_house_source_info"),
    geocoded_address: text("geocoded_address"),
    geocoded_longitude: real("geocoded_longitude"),
    geocoded_latitude: real("geocoded_latitude"),
    geocoding_source_info: text("geocoding_source_info"),
    has_water_supply: integer("has_water_supply"),
    has_juki_registry: integer("has_juki_registry"),
    has_touki_registry: integer("has_touki_registry"),
    has_juki_and_water: integer("has_juki_and_water"),
    has_vacant_result: integer("has_vacant_result"),
    has_juki_water_property: integer("has_juki_water_property"),
    has_geocoding: integer("has_geocoding"),
    has_juki_water_property_vacant: integer("has_juki_water_property_vacant"),

    fid: text("fid"),
    /**
     * GML ID
     */
    gml_id: text("gml_id"),
    class: text("class"),

    /**
     * ジオメトリデータ
     *
     * 文字列：任意の文字列
     */
    geometry: text("geometry").notNull(),

    /**
     * 計測高
     *
     * 単位：m
     * 小数で表現
     */
    measuredheight: real("measuredheight"),

    measuredheightUom: real("measuredheight_uom"),
    src_scale: text("src_scale"),
    geometry_src_desc: text("geometry_src_desc"),
    thematic_src_desc: text("thematic_src_desc"),
    lod1_height_type: text("lod1_height_type"),
    building_id: text("building_id"),
    prefecture: text("prefecture"),
    city: text("city"),
    description: text("description"),

    /**
     * 洪水浸水ランク
     *
     * 整数
     */
    rank: integer("rank"),
    /**
     * 洪水浸水深
     *
     * 単位：m
     * 整数
     */
    depth: integer("depth"),
    depth_uom: text("depth_uom"),
    admin_type: text("admin_type"),
    scale: text("scale"),

    /**
     * 洪水浸水時間
     *
     * 単位：h
     * 文字列：小数で表現
     */
    duration: real("duration"),
    duration_uom: text("duration_uom"),
    building_use: text("building_use"),

    /**
     * 地上階数
     *
     * 整数
     */
    floors_above_ground: integer("floors_above_ground"),
    /**
     * 地下階数
     *
     * 整数
     */
    floors_below_ground: integer("floors_below_ground"),

    value: real("value"),
    value_uom: text("value_uom"),

    /**
     * 洪水浸水リスク属性_建物
     *
     * 文字列：任意の文字列
     */
    inland_flooding_risk_desc: text("inland_flooding_risk_desc"),
    /**
     * 洪水浸水リスク属性_ランク
     *
     * 整数
     */
    inland_flooding_risk_rank: integer("inland_flooding_risk_rank"),
    /**
     * 洪水浸水リスク属性_浸水深
     *
     * 単位：m
     * 小数で表現
     */
    inland_flooding_risk_depth: real("inland_flooding_risk_depth"),
    inland_flooding_risk_depth_uom: text("inland_flooding_risk_depth_uom"),
    /**
     * 洪水氾濫リスク属性_建物
     *
     * 文字列：任意の文字列
     */
    river_flooding_risk_desc: text("river_flooding_risk_desc"),
    /**
     * 洪水氾濫リスク属性_ランク
     *
     * 整数
     */
    river_flooding_risk_rank: integer("river_flooding_risk_rank"),
    /**
     * 洪水氾濫リスク属性_氾濫深長
     *
     * 単位：m
     * 小数で表現
     */
    river_flooding_risk_depth: real("river_flooding_risk_depth"),
    river_flooding_risk_depth_uom: text("river_flooding_risk_depth_uom"),
    /**
     * 地滑りリスク属性_建物
     *
     * 文字列：任意の文字列
     */
    landslide_risk_desc: text("landslide_risk_desc"),

    large_store_name: text("large_store_name"),
    appearance_src_desc: text("appearance_src_desc"),
    branch_id: text("branch_id"),
    residence_id: text("residence_id"),
    is_test: integer("is_test"),

    /**
     * 建物名
     *
     * 文字列：任意の文字列
     */
    name: text("name"),

    area_type: text("area_type"),

    /**
     * 空き家推定結果
     *
     * 1: 空き家 / 0: 居住
     */
    predicted_label: integer("predicted_label"),
    /**
     * 空き家推定確率
     *
     * 0~1の小数で表現（8byte 浮動小数点）
     */
    predicted_probability: real("predicted_probability"),

    max_age: integer("max_age") /** 最大年齢 */,
    min_age: integer("min_age") /** 最小年齢 */,
    change_ratio_water_usage: real(
      "change_ratio_water_usage",
    ) /** 水道使用量変化率 */,

    created_at: text("created_at")
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text("updated_at")
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull()
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
);

export type SelectDataSetDetailBuilding =
  typeof data_set_detail_buildings.$inferSelect;
export type InsertDataSetDetailBuilding =
  typeof data_set_detail_buildings.$inferInsert;

export const data_set_detail_areas = sqliteTable("data_set_detail_areas", {
  id: integer("id").primaryKey(),
  data_set_result_id: integer("data_set_result_id"),

  /**
   * 推定日
   *
   * 推定の基準となる日付
   *
   * YYYY-MM-DD形式の文字列
   */
  reference_date: text("reference_date").notNull(),

  /**
   * 地域区分
   *
   * 文字列：町丁目レベルやの地域区分
   */
  area_group: text("area_group"),

  /**
   * 若年層率
   *
   * 0~1の小数で表現（8byte 浮動小数点）
   */
  young_population_ratio: real("young_population_ratio"),

  /**
   * 高齢者率
   *
   * 0~1の小数で表現（8byte 浮動小数点）
   */
  elderly_population_ratio: real("elderly_population_ratio"),

  /**
   * 建物数
   *
   * 0以上の整数
   */
  total_building_count: integer("total_building_count"),

  /**
   * 空き家件数
   *
   * 0以上の整数
   */
  vacant_house_count: integer("vacant_house_count"),

  /**
   * 面積
   *
   * 単位：m^2
   * 小数で表現（8byte 浮動小数点）
   */
  area: real("area"),

  /**
   * ジオメトリ
   *
   * 文字列：任意の文字列
   */
  geometry: text("geometry").notNull(),

  /**
   * KEYCODE
   *
   * 任意の文字列
   */
  key_code: text("key_code"),

  /**
   * 空き家推定確率
   *
   * 0~1の小数で表現（8byte 浮動小数点）
   */
  predicted_probability: real("predicted_probability"),

  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectDataSetDetailArea = typeof data_set_detail_areas.$inferSelect;
export type InsertDataSetDetailArea = typeof data_set_detail_areas.$inferInsert;

/** データセット:正規化済み */
export const normalized_data_sets = sqliteTable("normalized_data_sets", {
  id: integer("id").primaryKey(),
  // 表示・編集用のファイル名 初期値はnullになる
  file_name: text("file_name"),
  // job_resultsの内部パス / NOT NULL
  file_path: text("file_path").notNull(),
  job_results_id: integer("job_results_id").references(() => job_results.id),
  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectNormalizedDataSet = typeof normalized_data_sets.$inferSelect;
export type InsertNormalizedDataSet = typeof normalized_data_sets.$inferInsert;

/** データセット:シード */
export const raw_data_sets = sqliteTable("raw_data_sets", {
  id: integer("id").primaryKey(),
  // 表示・編集用のファイル名 / NOT NULL
  file_name: text("file_name").notNull(),
  // job_resultsの内部パス / NOT NULL
  file_path: text("file_path").notNull(),

  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectRawDataSet = typeof raw_data_sets.$inferSelect;
export type InsertRawDataSet = typeof raw_data_sets.$inferInsert;

export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey(),
  status: text("status", { enum: ["", "complete", "error"] }),
  type: text("type", { enum: ["preprocess", "ml", "result", "export"] }),
  process_id: integer("process_id"),
  is_named: integer("is_named", { mode: "boolean" }).notNull(), // 1: 名前をつけて保存済み / 0: 未保存

  parameters: text("parameters", { mode: "json" })
    .$type<JobParameters>()
    .notNull(),

  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectJob = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

export const job_tasks = sqliteTable("job_tasks", {
  id: integer("id").primaryKey(),
  job_id: integer("job_id")
    .references(() => jobs.id)
    .notNull(),
  progress_percent: text("progress_percent") /** @memo 結局使ってないかも */,
  preprocess_type: text("preprocess_type", {
    enum: [
      "e014",
      "e016",
    ] /** 実際にはバックエンドはこれ以外の値も保存する。FEはこの値しか使用しないのでこの定義とする */,
  }),
  error_code: text("error_code", { enum: ["undefined_error"] }),
  error_msg: text("error_msg"),

  // 完了したら設定される
  result: text("result", {
    mode: "json",
  }).$type<JobTaskResult>(),

  // 完了したら設定される
  finished_at: text("finished_at").default(sql`(CURRENT_TIMESTAMP)`),

  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectJobTask = typeof job_tasks.$inferSelect;
export type InsertJobTask = typeof job_tasks.$inferInsert;

export const job_results = sqliteTable("job_results", {
  id: integer("id").primaryKey(),
  job_id: integer("job_id")
    .references(() => jobs.id)
    .notNull(),
  // Pythonが吐き出した内部パス(path/to/normalizeの名前)
  file_path: text("file_path").notNull(),

  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectJobResult = typeof job_results.$inferSelect;
export type InsertJobResult = typeof job_results.$inferInsert;

export const model_files = sqliteTable("model_files", {
  id: integer("id").primaryKey(),
  file_name: text("file_name"),
  note: text("note"),
  // 内部パス
  file_path: text("file_path"),

  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectModelFile = typeof model_files.$inferSelect;
export type InsertModelFile = typeof model_files.$inferInsert;
