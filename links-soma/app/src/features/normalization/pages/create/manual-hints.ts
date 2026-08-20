/**
 * 名寄せウィザード サイドパネル用のマニュアルヒント
 *
 * 操作マニュアル「3.2 インプットデータの作成方法」の内容を、
 * 各データセット（ウィザードステップの schemaKey）ごとに構造化したもの。
 *
 * - 文言は後から差し替え可能にするため、表示ロジックから分離してここに集約する。
 * - lang.ts には置かない（別変更との衝突回避 + マニュアル由来データの責務分離）。
 * - ソース: designs/manual-extract.txt（マニュアル本文）。
 *   抜き出せない箇所はマニュアルの趣旨に沿った近似で補完している（後述）。
 */

/** 必要なカラム1件分（名前 / 説明 / 例） */
export type ManualColumnHint = {
  /** カラム名（参考例。実データの名称は任意） */
  name: string;
  /** どんな情報か・入力ルール */
  desc: string;
  /** データの例（任意） */
  example?: string;
};

/** 1データセット分のマニュアルヒント */
export type ManualHint = {
  /**
   * アップロード時に期待するファイル形式。複数ある場合はいずれか1つを選ぶ選択肢。
   * マニュアル「3.2 インプットデータの作成方法」各節の「データ形式」欄が出典。
   */
  formats: string[];
  /** 取得方法（箇条書き） */
  acquisition: string[];
  /** 必要なカラム一覧 */
  columns: ManualColumnHint[];
  /** 注意・サポート外表記などの警告（任意） */
  cautions?: string[];
};

/**
 * 住所カラムに共通するサポート外表記の注意（複数データセットで再利用）。
 * マニュアル P.40「サポート外の表記方法例」より。
 */
const ADDRESS_CAUTIONS: string[] = [
  "住所表記は「住居表示住所」か「地番住所」のどちらか一方にそろえてください。混在しているとデータ統合（名寄せ）ができません。",
  "「〇〇町105番地の1」「〇〇町5の6の3」のような「の」を使った表記はサポート外です。",
  "元データの文字コードが SHIFT_JIS の場合、UTF-8 保存時に住所が文字化けすることがあります。文字化けがあれば正しい住所に修正してください。",
];

/** CSV 出力を促す共通の取得方法注記 */
const CSV_RECOMMEND =
  "Excel 形式で入手すると文字コード変換でエラーになることがあります。できるだけ CSV 形式で出力してください。";

/** 期待するアップロード形式の表記（マニュアル「データ形式」欄の表記にそろえる） */
const FORMAT_CSV = "CSV";
const FORMAT_SHAPEFILE_ZIP = "ZIP（Shapefile）";
const FORMAT_GPKG = "gpkg（ジオパッケージ）";

/**
 * schemaKey → マニュアルヒント。
 * キーは wizard-steps.ts の DataKeys（FormNormalizationType["data"] のキー）と一致させる。
 */
export const MANUAL_HINTS: Record<string, ManualHint> = {
  // ===== 水道開閉栓状況（必須） =====
  water_status: {
    formats: [FORMAT_CSV],
    acquisition: [
      "水道局の検針担当部署（料金課など）へデータ提供依頼を行うのが一般的です。",
      "上下水道料金徴収システムなどから CSV 出力するのが一般的です。",
      CSV_RECOMMEND,
    ],
    columns: [
      {
        name: "水道番号",
        desc: "水道を一意に識別する数値・記号・アルファベットで構成される文字列。水道使用量データと対応させます。",
        example: "1",
      },
      {
        name: "水道閉栓年月",
        desc: "和暦または西暦の年月／年月日（文字列）。",
        example: "20160929",
      },
      {
        name: "水道開栓年月",
        desc: "和暦または西暦の年月／年月日（文字列）。",
        example: "19810321",
      },
      {
        name: "住所",
        desc: "水道の所在地の住所（文字列）。",
        example: "青木町〇〇‐〇〇",
      },
    ],
    cautions: ADDRESS_CAUTIONS,
  },

  // ===== 水道使用量（必須） =====
  water_usage: {
    formats: [FORMAT_CSV],
    acquisition: [
      "水道局の検針担当部署（料金課など）へデータ提供依頼を行うのが一般的です。",
      "上下水道料金徴収システムなどから CSV 出力するのが一般的です。",
      "基準日から遡って1年分のデータを用意します（月ごとに分かれている場合は1つに統合）。",
      CSV_RECOMMEND,
    ],
    columns: [
      {
        name: "水道番号",
        desc: "水道を一意に識別する文字列。水道開閉栓状況の水道番号と対応させる必要があります。",
        example: "1",
      },
      {
        name: "水道使用量",
        desc: "数値（単位：㎥）。数値でない値が入っている行は削除または修正します。",
        example: "35",
      },
      {
        name: "水道検針年月日",
        desc: "和暦または西暦の年月／年月日（文字列）。",
        example: "20010101",
      },
    ],
  },

  // ===== 住民基本台帳（必須） =====
  resident_registry: {
    formats: [FORMAT_CSV],
    acquisition: [
      "住民基本台帳システム（住基ネット）から必要なカラムを含むデータを CSV 出力します。",
      "自治体の管轄部署（市民課等）へデータ提供依頼を行うのが一般的です。",
      CSV_RECOMMEND,
    ],
    columns: [
      {
        name: "世帯番号",
        desc: "世帯を一意に識別する数値。",
        example: "1",
      },
      {
        name: "住所",
        desc: "世帯の住所（文字列）。",
        example: "青木町〇〇‐〇〇",
      },
      {
        name: "生年月日",
        desc: "和暦または西暦（文字列）。",
        example: "昭和55年3月4日",
      },
      {
        name: "住定年月日",
        desc: "和暦または西暦（文字列）。",
        example: "19990904",
      },
      {
        name: "異動事由",
        desc: "世帯員の異動事由（文字列）。コードで入力されている場合は文字列に変換します（例: 123 → 転入）。",
        example: "転入",
      },
      {
        name: "異動年月日",
        desc: "和暦または西暦（文字列）。",
        example: "19990904",
      },
    ],
    cautions: ADDRESS_CAUTIONS,
  },

  // ===== ジオコーディングデータ（任意） =====
  geocoding: {
    formats: [FORMAT_CSV],
    acquisition: [
      "本システム同梱の「ジオコーディングツール」等で作成できます（使い方はマニュアル P.62 参照）。",
      "住所・緯度・経度の対応情報を用意します。",
    ],
    columns: [
      {
        name: "住所",
        desc: "緯度経度に対応させる住所（文字列）。",
        example: "青木町〇〇‐〇〇",
      },
      {
        name: "緯度",
        desc: "住所に対応する緯度（数値）。",
        example: "34.123456",
      },
      {
        name: "経度",
        desc: "住所に対応する経度（数値）。",
        example: "137.123456",
      },
    ],
    cautions: ADDRESS_CAUTIONS,
  },

  // ===== 登記情報（任意） =====
  building_registry: {
    formats: [FORMAT_CSV],
    acquisition: [
      "登記簿は法務局に申請して取得します。",
      "登記情報連携システム等がある場合は管轄の課にデータ取得依頼をします。",
      CSV_RECOMMEND,
    ],
    columns: [
      {
        name: "住所",
        desc: "建物の住所（文字列）。複数列に跨る場合は1つの列に統合します。",
        example: "青木町〇〇‐〇〇",
      },
      {
        name: "建物構造名",
        desc: "建物の構造を示す文字列。先頭表記で構造区分を判定します（例: 鉄筋コンクリート/RC造 → 鉄筋コンクリート造）。",
        example: "木造瓦葺2階建て",
      },
      {
        name: "登記理由",
        desc: "登記理由を示す文字列。「登記理由発生年月日＋登記理由」の形式に修正します。",
        example: "平成15年12月4日新築",
      },
      {
        name: "登記日付",
        desc: "建物の建築や登録年月日（西暦または和暦）。",
        example: "20031204",
      },
    ],
    cautions: ADDRESS_CAUTIONS,
  },

  // ===== 建物ポリゴンデータ（任意） =====
  building_polygon: {
    formats: [FORMAT_SHAPEFILE_ZIP, FORMAT_GPKG],
    acquisition: [
      "PLATEAU を整備済みの自治体は、同梱の「LINKS SOMA CityGML Converter」で gpkg 形式に変換して利用できます。",
      "PLATEAU の CityGML データは G空間情報センター（https://www.geospatial.jp/ckan/dataset/plateau）から取得します。",
      "PLATEAU が無い場合は家屋現況図・基盤地図情報等の建物ポリゴンデータ（Shapefile / gpkg）を用意します。",
    ],
    columns: [
      {
        name: "建物ID",
        desc: "建物を一意に識別する ID。",
        example: "BLD_0001",
      },
      {
        name: "ポリゴンジオメトリ",
        desc: "緯度経度が付与された建物形状（多角形の面データ）。",
      },
    ],
  },

  // ===== 処理対象選定用データ（任意） =====
  building_type_determination: {
    formats: [FORMAT_SHAPEFILE_ZIP, FORMAT_GPKG, FORMAT_CSV],
    acquisition: [
      "登記情報・建物ポリゴンデータ、または自治体が保有する建物種別を示すデータから作成します。",
      "建物種別ごとに空き家推定の対象にするかを選択できます（種別不明は推定対象）。",
    ],
    columns: [
      {
        name: "住所",
        desc: "建物の住所（文字列）。",
        example: "青木町〇〇‐〇〇",
      },
      {
        name: "建物種別",
        desc: "住宅・店舗・事業所など建物の種別を示す文字列。",
        example: "住宅",
      },
    ],
    cautions: ADDRESS_CAUTIONS,
  },

  // ===== 空き家調査結果（任意・教師データ） =====
  vacant_house: {
    formats: [FORMAT_CSV],
    acquisition: [
      "自治体の空き家管轄部署（都市計画課など）が保有する過去の空き家調査から取得するのが一般的です。",
      "民間から購入可能な家屋利用状況データ（電力使用量データ等）も利用できます。",
      CSV_RECOMMEND,
    ],
    columns: [
      {
        name: "住所",
        desc: "空き家と推定された家屋の住所（文字列）。",
        example: "青木町〇〇‐〇〇",
      },
    ],
    cautions: ADDRESS_CAUTIONS,
  },

  // ===== 建物関連データ（任意） =====
  optional_data_source: {
    formats: [FORMAT_CSV],
    acquisition: [
      "名寄せ結果に追加したい説明変数を含む CSV を用意します。",
      "住所カラムで名寄せされ、全カラムが説明変数の候補として出力に追加されます。",
    ],
    columns: [
      {
        name: "住所",
        desc: "名寄せのキーとなる住所（文字列）。",
        example: "青木町〇〇‐〇〇",
      },
    ],
    cautions: ADDRESS_CAUTIONS,
  },
};

/**
 * schemaKey からマニュアルヒントを取得する。未定義なら undefined。
 */
export const getManualHint = (
  schemaKey: string | null | undefined,
): ManualHint | undefined => {
  if (!schemaKey) return undefined;
  return MANUAL_HINTS[schemaKey];
};
