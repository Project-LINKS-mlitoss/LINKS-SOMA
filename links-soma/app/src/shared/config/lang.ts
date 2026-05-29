/**
 * @description
 * #### 言語とツールチップをマッピングするためのファイル
 * - app/src/components/ui/text-with-tooltip.tsx とセットで利用することを想定している
 * - ツールチップの内容を変更する場合は、このファイルを編集する
 * - オブジェクトの階層構成は /pages, /components 配下と同期させる
 * - pages[model/create] のように、pages, components 以下のファイルパスを表現する(オブジェクトの3階層目には必ず画面の言語Keyがくる)
 * - 言語keyは、labelを必須・descriptionを任意で持つ
 */
export const lang = {
  pages: {
    "model/create": {
      subtitle1: {
        label: "① 名寄せ済みデータセット一覧から選択",
        description: `空き家推定確率を推定するモデルを構築するため、「名寄せ済みデータセット」を選択します。名寄せ済みのデータセットが無い場合には、「名寄せ処理」を実施してください。`,
      },
      subtitle2: {
        label: "② 説明変数に使うカラムの選択",
        description: `①で名寄せ済みデータセットを選択すると、説明変数に使うカラムを選択できます。名寄せ処理済みデータセットのうち、説明変数に必ず使うカラムはすでに選択されます。それ以外に機械学習に使いたい情報があれば、カラムを選択してください。

※「説明変数」とは、機械学習によって空き家推定確率を推定するための情報のことです。
（例）「水道閉開栓状態と水道使用量から、空き家かどうかを推定したい」 → 「水道開閉栓状況」と「水道使用量」を説明変数として選択します。`,
      },
      subtitle3: {
        label: "③ パラメーターを変更",
        description: `機械学習によるモデル構築の精度を調整するパラメータを変更できます。特に変更の必要がない場合には、デフォルトの状態のままにしてください。`,
      },
    },
    "evaluation/create": {
      subtitle1: {
        label: "② 利用するモデルを選択",
        description: `空き家推定確率の推定に使う構築済みモデルを選択してください。モデルの構築を行ってない場合には、「モデル構築」から処理を実行してください。`,
      },
      subtitle2: {
        label: "① 分析対象のデータを選択",
        description: `空き家推定確率を推定したい時点のデータセットを選択してください。最新の名寄せ処理済みデータセットが無い場合には、「名寄せ処理」から処理を実行してください。`,
      },
      subtitle3: {
        label: "③ 地域集計用データを選択",
        description: `小学校区や都市計画図等、空き家推定確率の推定を分析する単位となるデータを選択してください。データの作成方法等については、操作マニュアルを参照してください。`,
      },
      column1: {
        label: "地域IDカラム",
        description: `インプットしたデータのなかから、集計単位の地域ごとに固有につけられている番号/IDを示すカラム（項目名）を選択してください。`,
      },
      column2: {
        label: "地域名称カラム",
        description: `インプットしたデータのなかから、集計単位の地域ごとに固有につけられている番号/IDを示すカラム（項目名）を選択してください。`,
      },
      subtitle4: {
        label: "④ 高度な設定",
        description: `【空き家推定確率推定の精度を調整するパラメータを変更できます。特に変更の必要がない場合には、デフォルトの状態のままにしてください`,
      },
      settingsThreshold: {
        label: "空き家推定確率の閾値",
      },
    },
  },
  components: {
    "dialog-model-advanced": {
      dialogTitle: "高度な設定を変更",
      test_size: {
        label: "テストサイズ",
        description: `（Test Size）モデルの評価に使う「テストデータ」の割合のこと。データを学習用（トレーニングデータ）と評価用（テストデータ）に分ける際、テストデータが全体のどれくらいの割合かを指定します。`,
      },
      n_splits: {
        label: "スプリット数",
        description: `（Number of Splits）データを分割して検証する際の分割回数。特に「クロスバリデーション（交差検証）」で、データを何回分けて学習と評価を繰り返すかを指定します。`,
      },
      undersample: {
        label: "アンダーサンプリングの使用",
        description: `（Use Undersampling）不均衡なデータ（例: 一部のクラスが少ない場合）に対して、多すぎるクラスのデータを減らす処理を行うかどうかを設定します。`,
      },
      undersample_ratio: {
        label: "アンダーサンプリング比率",
        description: `（Undersample Ratio）アンダーサンプリングを行う際、多すぎるクラスをどの程度まで減らすかを指定する比率を設定します。`,
      },
      threshold: {
        label: "しきい値",
        description: `（Threshold）予測結果を分類するための基準となる値。特に確率を出力するモデルで、「どの確率以上を陽性と判断するか」を決める値を指定します。`,
      },
      hyperparameter_flag: {
        label: "ハイパーパラメータチューニングの使用",
        description: `（Hyperparameter Tuning）モデルの性能を上げるために、ハイパーパラメータ（モデルの設定値）を自動的に調整する作業を行うかどうかを設定します。その代わり、処理時間が長くなります。`,
      },
      n_trials: {
        label: "ハイパーパラメータチューニングの試行回数",
        description: `（Number of Trials for Hyperparameter Tuning）ハイパーパラメータを調整する際、異なる設定を何回試すかを指定する値を設定します。回数が多いほど処理時間が長くなります。`,
      },
      lambda_l1: {
        label: "ラムダL1",
        description: `（Lambda L1）不要な特徴量をゼロに近づけることで、モデルをシンプルにするL1正規化の強さを設定します。`,
      },
      lambda_l2: {
        label: "ラムダL2",
        description: `（Lambda L2）モデルの重みが大きくなりすぎないようにペナルティを与えるL2正規化の強さを設定します。`,
      },
      num_leaves: {
        label: "リーフ数",
        description: `（Number of Leaves）決定木や勾配ブースティングモデルで、1つの木の中で最終的な分岐先（リーフ）の数を指定します。`,
      },
      feature_fraction: {
        label: "フィーチャー割合",
        description: `（Feature Fraction）モデルを作るときに、全ての特徴量（フィーチャー）のうち、どれくらいの割合を使用するかを指定します。`,
      },
      bagging_fraction: {
        label: "バギング割合",
        description: `（Bagging Fraction）バギング（Bagging：標本抽出）を行う際、全体のデータからどれだけの割合をランダムに選んで使うかを指定します。`,
      },
      bagging_freq: {
        label: "バギング頻度",
        description: `（Bagging Frequency）勾配ブースティングモデルで、何回ごとにバギングを行うかを指定します。`,
      },
      min_data_in_leaf: {
        label: "リーフ内の最小データ数",
        description: ``,
      },
      saveButton: "保存",
    },
    normalizationParameters: {
      address: {
        shortLabel: "住所",
        label: "住所カラム",
        description:
          "インプットしたデータのなかから、家屋が所在する住所を示すカラム（項目名）を選択してください。",
      },
      latitude: {
        shortLabel: "緯度",
        label: "緯度カラム",
        description:
          "家屋が所在する緯度を示すカラム（項目名）を選択してください。",
      },
      longitude: {
        shortLabel: "経度",
        label: "経度カラム",
        description:
          "家屋が所在する経度を示すカラム（項目名）を選択してください。",
      },
      household_code: {
        shortLabel: "世帯番号",
        label: "世帯番号カラム",
        description:
          "インプットしたデータのなかから、世帯ごとに固有につけられている番号/IDを示すカラム（項目名）を選択してください。",
      },
      birth_date: {
        shortLabel: "生年月日",
        label: "生年月日カラム",
        description:
          "インプットしたデータのなかから、住民の生年月日を示すカラム（項目名）を選択してください。",
      },
      gender: {
        label: "性別カラム",
        description:
          "インプットしたデータのなかから、住民の性別を示すカラム（項目名）を選択してください。※性別は数字で表記してください。",
      },
      resident_date: {
        shortLabel: "住定年月日",
        label: "住定年月日カラム",
        description:
          "インプットしたデータのなかから、住民がその住所に住み始めた年月日を示すカラム（項目名）を選択してください。",
      },
      reason_transfer: {
        shortLabel: "異動事由",
        label: "異動事由カラム",
        description:
          "インプットしたデータのなかから、住民の異動事由を示すカラム（項目名）を選択してください。",
      },
      date_transfer: {
        shortLabel: "異動日",
        label: "異動日カラム",
        description:
          "インプットしたデータのなかから、住民の異動日を示すカラム（項目名）を選択してください。",
      },
      water_supply_number: {
        shortLabel: "水道番号",
        label: "水道番号カラム",
        description:
          "インプットしたデータのなかから、水道ごとに固有につけられている番号/IDを示すカラム（項目名）を選択してください。※「水道使用量」データの水道番号カラムと対応する必要があります。",
      },
      water_disconnection_date: {
        shortLabel: "水道閉栓年月",
        label: "水道閉栓年月カラム",
        description:
          "インプットしたデータのなかから、水道の閉栓年月や日付を示すカラム（項目名）を選択してください。",
      },
      water_connection_date: {
        shortLabel: "水道開栓年月",
        label: "水道開栓年月カラム",
        description:
          "インプットしたデータのなかから、水道の開栓年月や日付を示すカラム（項目名）を選択してください。",
      },
      water_disconnection_flag: {
        label: "水道開閉栓フラグカラム",
        description:
          "インプットしたデータのなかから、水道の閉栓有無を示すカラム（項目名）を選択してください。※有無を示すフラグは数字で表記してください。",
      },
      water_usage: {
        shortLabel: "水道使用量",
        label: "水道使用量カラム",
        description:
          "インプットしたデータのなかから、家屋ごとの水道使用量を示すカラム（項目名）を選択してください。",
      },
      water_recorded_date: {
        shortLabel: "水道検針年月日",
        label: "水道検針年月日カラム",
        description:
          "インプットしたデータのなかから、家屋ごとの水道検針年月日を示すカラム（項目名）を選択してください。",
      },
      structure_name: {
        shortLabel: "構造名",
        label: "構造名カラム",
        description:
          "インプットしたデータのなかから、家屋の構造（木造、RC造等）を示すカラム（項目名）を選択してください。",
      },
      registration_date: {
        shortLabel: "登記日付",
        label: "登記年月日カラム",
        description:
          "インプットしたデータのなかから、家屋の建築（登録）年月日を示すカラム（項目名）を選択してください。",
      },
      vacant_house_id: {
        label: "空き家IDカラム",
        description:
          "インプットしたデータのなかから、空き家IDを示すカラム（項目名）を選択してください。",
      },
      building_id: {
        label: "建物IDカラム",
        description:
          "インプットしたデータのなかから、家屋ごとに固有の建物IDを示すカラム（項目名）を選択してください。",
      },
      inheritance_detail: {
        label: "相続内容カラム",
        description:
          "インプットしたデータのなかから、建物の相続内容を示すカラム（項目名）を選択してください。",
      },
      extension_detail: {
        label: "増築内容カラム",
        description:
          "インプットしたデータのなかから、建物の増築内容を示すカラム（項目名）を選択してください。",
      },
      reference_date: {
        label: "推定日カラム",
        description:
          "インプットしたデータのなかから、分析時点の推定日を示すカラム（項目名）を選択してください。",
      },
      reference_data: {
        label: "基準データカラム",
        description:
          "インプットしたデータのなかから、基準となるデータを示すカラム（項目名）を選択してください。",
      },
      geometry: {
        label: "ジオメトリカラム",
        description:
          "インプットしたデータのなかから、地理空間情報（ジオメトリ）を示すカラム（項目名）を選択してください。",
      },
      land_number_address: {
        label: "地番住所カラム",
        description:
          "インプットしたデータのなかから、地番住所を示すカラム（項目名）を選択してください。",
      },
      residential_address: {
        label: "住居表示住所カラム",
        description:
          "インプットしたデータのなかから、住居表示住所を示すカラム（項目名）を選択してください。",
      },
      lat: {
        label: "緯度カラム",
        description:
          "インプットしたデータのなかから、緯度を示すカラム（項目名）を選択してください。※CSVファイルの場合のみ必須。",
      },
      lon: {
        label: "経度カラム",
        description:
          "インプットしたデータのなかから、経度を示すカラム（項目名）を選択してください。※CSVファイルの場合のみ必須。",
      },
      building_type: {
        shortLabel: "家屋種別",
        label: "家屋種別カラム",
        description:
          "インプットしたデータのなかから、家屋種別を示すカラム（項目名）を選択してください。",
      },
      registration_reason: {
        shortLabel: "登記理由",
        label: "登記理由カラム",
        description:
          "インプットしたデータのなかから、登記理由を示すカラム（項目名）を選択してください。",
      },
      building_type_values: {
        label: "家屋種別",
        description:
          "推定対象とする家屋種別として、共同住宅以外の「居住の用に供する家屋」の種別を指定してください。※本システムは共同住宅を除く住宅（居住の用に供する家屋）を対象として開発しています。",
      },
      settings: {
        description: "推定対象の市区町村名と推定日を設定してください。",
      },
      settingsReferenceDate: {
        description:
          "空き家確率を推定したい時点を設定してください。異なる時点での推定を行いたい場合は、その都度、推定日を変えて名寄せ処理を実行してください。",
      },
      settingsMunicipality: {
        description:
          "推定対象の市区町村名を入力してください。名寄せ処理で住所を照合する際に利用します。都道府県名は含めないでください。",
        placeholder: "市区町村名を入力",
        suffixNote:
          "末尾が「市」「区」「町」「村」で終わるように入力してください",
      },
      wizardIntro: {
        label: "データの準備",
        description: "名寄せ処理に必要なデータを確認してください。",
        introText:
          "名寄せ処理を始める前に、以下のインプットデータを手元にご準備ください。",
        datasetManagementLink: "データセット管理",
        datasetManagementSuffix:
          "からまとめてアップロードしておくことも可能です。",
        requiredSection: "必須データ",
        optionalSection: "任意データ",
      },
      wizardConfirmation: {
        label: "確認",
        description: "入力内容を確認して処理を開始します",
      },
    },
    normalizationData: {
      residentRegistry: {
        label: "住民基本台帳",
        description: "住民票の情報を示すデータ。",
      },
      waterStatus: {
        label: "水道閉開栓状況",
        description: "家屋単位の水道栓の状況を示すデータ。",
      },
      waterUsage: {
        label: "水道使用量",
        description:
          "家屋単位の水道使用量を示すデータ。推定したい日付から遡って1年分のデータを用意してください（推定したい日付より未来日を入れるとエラーになります）",
      },
      buildingRegistry: {
        label: "登記情報",
        description:
          "家屋単位の建築年や構造、相続情報を示すデータ。「登記簿」から作成される情報を入力することで精度向上が期待できます。",
      },
      census: {
        label: "国勢調査",
        description:
          "政府統計の窓口サイト「e-Stat」よりからダウンロードできる国勢調査データのうち、「町丁・字等境界データ」を使用します。",
      },
      buildingTypeDetermination: {
        label: "推定対象選定用データ",
        description:
          "推定対象とする家屋の種別を指定するデータ。指定した種別の家屋を推定対象とすることができます。このデータを入れない場合は、全ての家屋は「種別不明」として扱われ推定の対象となります。",
      },
      geocoding: {
        label: "ジオコーディングデータ",
        description:
          "住所から緯度経度を取得したデータ。地図上での位置表示に使用されます。",
      },
      buildingPolygon: {
        label: "建物ポリゴンデータ",
        description:
          "建物の輪郭を表すポリゴンデータ。建物IDと紐づけることで地図上に建物形状を表示できます。",
      },
      vacantHouse: {
        label: "空き家調査結果",
        description:
          "空き家の住所一覧を含むCSVデータ。モデル学習の教師データとして使用されます。",
      },
      optionalDataSource: {
        label: "説明変数追加用データ",
        description:
          "名寄せ結果に追加したい説明変数を含むCSVデータ。住所カラムで名寄せされ、全カラムが説明変数の候補として出力に追加されます。",
      },
    },
    "form-normalization": {
      requiredDataSection: {
        title: "必須データの選択",
        description:
          "名寄せ処理に必須のデータセットです。すべて選択してください。",
      },
      optionalDataSection: {
        title: "任意データの選択",
        description:
          "精度向上のために追加できるデータセットです。必要に応じて選択してください。",
      },
    },
    "job-parameters-section": {
      heading: "実行設定",
      modelFile: "モデルファイル",
      normalizedDataset: "名寄せ済みデータセット",
      explanatoryVariables: "説明変数",
      areaGroupingData: "地域集計用データ",
      fileType: "ファイル形式",
      coordinateSystem: "座標系",
      targetUnit: "対象単位",
      targetUnitBuilding: "建物単位",
      targetUnitArea: "地域単位",
      referenceView: "参照ビュー",
      targetDataset: "対象データセット",
      dataTypePlateau: "PLATEAU",
      dataTypeOthers: "その他",
      viewTitleEmpty: "(タイトル未設定)",
      deleted: "(削除済み)",
    },
  },
  columns: {
    building: {
      area_group: {
        description:
          "地域集計用データに入力したデータに基づき、当該建物が属する地域の名称",
      },
      normalized_address: {
        description:
          "住民基本台帳の住所を「名寄せ処理」において正規化した住所データ",
      },
      reference_date: {
        description:
          "モデル構築および空き家推定における基準とする年月日。「名寄せ処理」において設定した推定日（推定したい日付）を示す。",
      },
      household_size: {
        description: "世帯人数（住定人数から転出・死亡を差し引いた人数）",
      },
      members_under_15: {
        description:
          "推定日時点で15歳未満（生年月日から算出）となる同一世帯番号の人数",
      },
      members_over_65: {
        description:
          "推定日時点で65歳以上（生年月日から算出）となる同一世帯番号の人数",
      },
      predicted_probability: {
        description:
          "空き家の推定確率を示す。0～1の間で確率が示され、1に近いほど空き家である確率が高い。",
      },
      predicted_label: {
        description:
          "空き家推定の結果、「空き家かどうか」を「モデル構築」の際のしきい値（高度な設定）を基準に判定したフラグ。非空き家は「0」、空き家は「1」で示す。デフォルトの設定では空き家推定確率30%以上（しきい値：0.3）を空き家として判定。",
      },
      water_disconnection_flag: {
        description:
          "水道開閉栓状況データに記載された、閉栓かどうかを示すのフラグ",
      },
      max_water_usage: {
        description:
          "推定日から１年以内において水道使用量が最大の月の水道使用量（検針周期により２か月単位の量）",
      },
      avg_water_usage: {
        description:
          "推定日から１年以内における月の平均水道使用量（検針周期により２か月単位の量）",
      },
      total_water_usage: {
        description:
          "推定日から１年以内における合計水道使用量（検針周期により２か月単位の量）",
      },
      structure_name: {
        description: "登記情報データに記載された建物構造",
      },
      measured_height: {
        description: "PLATEAUの建物モデルデータに含まれる、計測高さ",
      },
      name: {
        description: "PLATEAUの建物モデルデータに含まれる、名称",
      },
      inland_flooding_risk_rank: {
        description: "",
      },
      inland_flooding_risk_depth: {
        description:
          "PLATEAUの建物モデルデータに含まれる、内水浸水リスクランク",
      },
      landslide_risk_description: {
        description:
          "PLATEAUの建物モデルデータに含まれる、土砂災害リスク　現象区分",
      },
      river_flooding_risk_description: {
        description: "PLATEAUの建物モデルデータに含まれる、指定河川名称",
      },
      river_flooding_risk_rank: {
        description: "PLATEAUの建物モデルデータに含まれる、浸水ランク",
      },
      river_flooding_risk_depth: {
        description: "PLATEAUの建物モデルデータに含まれる、浸水深",
      },
      buildingtype_determination_not_possible_flag: {
        description:
          "空き家推定の結果、家屋種別の判定が不可能であるかどうかを示すフラグ。判定不可能な場合は「1」、それ以外は「0」で示す。",
      },
      days_since_registration_event: {
        description:
          "登記事由発生日からの経過日数。登記情報データから算出される。",
      },
      address: {
        description: "建築物の住所",
      },
      area_classification_type: {
        description: "土地の区分を示す",
      },
      bldg_dm_attribute: {
        description: "建物の図形表現に関する情報",
      },
      bldg_facility_attribute: {
        description: "施設の管理に関する情報",
      },
      bldg_facility_id_attribute: {
        description: "施設を識別するための情報",
      },
      bldg_facility_type_attribute: {
        description: "施設の分類に関する情報",
      },
      bldg_real_estate_id_attribute: {
        description: "建築物に紐づく不動産IDの情報",
      },
      bldg_usecase_attribute: {
        description: "建築物を使用するユースケースのための属性",
      },
      bounded_by: {
        description: "建物の外壁、屋根等の境界面に関する情報",
      },
      building_data_quality_attribute: {
        description: "建物データの品質に関する情報",
      },
      building_detail_attribute: {
        description: "建物の基礎的な詳細情報",
      },
      building_disaster_risk_attribute: {
        description: "建物の災害リスクに関する情報",
      },
      hightide_risk_depth: {
        description: "高潮浸水時の浸水の深さ",
      },
      hightide_risk_depth_uom: {
        description: "高潮浸水時の浸水の深さの単位",
      },
      hightide_risk_description: {
        description: "高潮浸水時の説明",
      },
      hightide_risk_rank: {
        description: "高潮浸水時の浸水ランク",
      },
      landslide_risk_areatype: {
        description: "土砂災害警戒区域の有無",
      },
      river_flooding_risk_admin_type: {
        description: "洪水予報河川又は水位周知河川を指定した機関の種類",
      },
      tsunami_risk_depth: {
        description: "津波浸水想定時の深さ",
      },
      tsunami_risk_depth_uom: {
        description: "津波浸水想定時の深さの単位",
      },
      tsunami_risk_description: {
        description: "津波浸水想定に関する属性情報",
      },
      tsunami_risk_rank: {
        description: "津波浸水想定の水位区分",
      },
      building_footprint_area: {
        description: "建築物の壁や柱の中心線で囲まれた部分の水平投影面積",
      },
      building_footprint_area_uom: {
        description: "建築物の壁や柱の中心線で囲まれた部分の水平投影面積の単位",
      },
      building_height: {
        description: "建築物の高さ",
      },
      building_height_uom: {
        description: "建築物高さの単位",
      },
      building_id_attribute: {
        description: "建築物の識別情報",
      },
      building_structure_type: {
        description: "建物の構造種別",
      },
      consists_of_building_part: {
        description: "建物を構成する部品建築物",
      },
      bldg_creation_date: {
        description: "データの作成日",
      },
      districts_and_zones_type: {
        description: "都市計画法に基づく地域地区",
      },
      function_plateau: {
        description: "建物の機能",
      },
      generic_attribute: {
        description: "汎用的な属性情報",
      },
      ifc_building_attribute: {
        description: "IFC（Industry Foundation Classes）形式の建物属性",
      },
      indoor_building_attribute: {
        description: "屋内ナビゲーションのための属性",
      },
      interior_building_installation: {
        description: "建物内の屋内付属物",
      },
      interior_room: {
        description: "建物内の部屋情報",
      },
      key_value_pair_attribute: {
        description: "拡張属性をキー・バリュー形式で格納",
      },
      large_customer_facility_attribute: {
        description: "大規模小売店舗に関する情報",
      },
      lod_type: {
        description: "LOD（Level of Detail）の種別",
      },
      org_usage2: {
        description: "建物利用現況の小分類",
      },
      outer_building_installation: {
        description: "建物の外部付属物",
      },
      parent_type: {
        description: "親要素のタイプ",
      },
      roof_type: {
        description: "屋根形状の種類",
      },
      storey_heights_above_ground: {
        description: "地上の各階の高さ",
      },
      storey_heights_below_ground: {
        description: "地下の各階の高さ",
      },
      storeys_above_ground: {
        description: "地上階の階数",
      },
      storeys_below_ground: {
        description: "地下階の階数",
      },
      survey_year: {
        description: "建物利用現況調査の実施年",
      },
      termination_date: {
        description: "データが削除された日",
      },
      total_floor_area: {
        description: "当該建築物の各階の床面積の合計",
      },
      total_floor_area_uom: {
        description: "当該建築物の各階の床面積の単位",
      },
      year_of_construction: {
        description: "建築された年",
      },
      year_of_demolition: {
        description: "解体された年",
      },
      key_code: {
        description: "地域名称コード",
      },
      building_type: {
        description: "建物の種別",
      },
      water_startdate: {
        description: "水道使用開始日",
      },
      water_enddate: {
        description: "水道使用中止日",
      },
      residence_duration: {
        description: "住定期間",
      },
      has_juki_registry: {
        description: "住基台帳記載",
      },
      building_use: {
        description: "家屋種別",
      },
      river_flooding_risk_scale: {
        description: "洪水浸水想定時の想定最大規模降雨あるいは計画規模降雨区分",
      },
      river_flooding_risk_duration: {
        description: "洪水浸水想定時の継続する時間",
      },
      river_flooding_risk_duration_uom: {
        description: "洪水浸水想定時の継続する時間の単位",
      },
      registration_date: {
        description: "登記日付",
      },
      date_registration_event: {
        description: "登記事由発生日",
      },
      waterusage_11to12m_ago: {
        description:
          "検針水量（推定月の11・12ヶ月前）（検針周期により2ヶ月単位の量）",
      },
      waterusage_9to10m_ago: {
        description:
          "検針水量（推定月の9・10ヶ月前）（検針周期により2ヶ月単位の量）",
      },
      waterusage_7to8m_ago: {
        description:
          "検針水量（推定月の7・8ヶ月前）（検針周期により2ヶ月単位の量）",
      },
      waterusage_5to6m_ago: {
        description:
          "検針水量（推定月の5・6ヶ月前）（検針周期により2ヶ月単位の量）",
      },
      waterusage_3to4m_ago: {
        description:
          "検針水量（推定月の3・4ヶ月前）（検針周期により2ヶ月単位の量）",
      },
      waterusage_1to2m_ago: {
        description:
          "検針水量（推定月の1・2ヶ月前）（検針周期により2ヶ月単位の量）",
      },
      max_age: {
        description: "世帯内の最大年齢",
      },
      num_deaths: {
        description: "死亡人数",
      },
      num_inmigrants: {
        description: "転入数",
      },
      num_outmigrants_relocations: {
        description: "転出・転居数",
      },
      num_cancellations: {
        description: "職権消除数",
      },
      years_water_closure: {
        description: "閉栓後年数",
      },
      average_waterusage_person: {
        description: "一人当たり検針水量",
      },
      change_rate_waterusage_over_last4months: {
        description: "直近４ヶ月の使用量増減率",
      },
      flag_zero_usage_over4consecutivemonths: {
        description: "連続4か月使用量0フラグ",
      },
      flag_concreteblock: {
        description: "コンクリートブロック造",
      },
      flag_brick: {
        description: "煉瓦造",
      },
      flag_reinforcedconcreteconstruction: {
        description: "鉄筋コンクリート造",
      },
      flag_steelframe: {
        description: "鉄骨造",
      },
      flag_wood: {
        description: "木造",
      },
      flag_earthen: {
        description: "土造",
      },
      flag_otherstructures: {
        description: "その他構造",
      },
      flag_inheritance: {
        description: "相続の有無",
      },
      flag_gift: {
        description: "贈与の有無",
      },
      flag_sale: {
        description: "売買の有無",
      },
      flag_seizure: {
        description: "差押の有無",
      },
    },
    area: {
      area: {
        description: "地域集計用データにおける地域ごとの面積",
      },
      area_group: {
        description:
          "地域集計用データに入力したデータに基づき、当該建物が属する地域の名称",
      },
      young_population_ratio: {
        description:
          "地域単位における、推定日時点で15歳未満（生年月日から算出）となる人口の割合",
      },
      elderly_population_ratio: {
        description:
          "地域単位における、推定日時点で65歳以上（生年月日から算出）となる人口の割合",
      },
      total_building_count: {
        description: "地域単位における、住民基本台帳上の戸建て住宅の数",
      },
      predicted_probability: {
        description:
          "地域単位において、地域内の住宅数に占める推定空き家数の割合",
      },
      vacant_house_count: {
        description: `地域単位において、地域内の建物ごとの空き家推定結果を集計した結果
※空き家推定結果：空き家推定の結果、「空き家かどうか」を「モデル構築」の際のしきい値（高度な設定）を基準に判定したフラグ。非空き家は「0」、空き家は「1」で示す。デフォルトの設定では空き家推定確率30%以上（しきい値：0.3）を空き家として判定。`,
      },
      unestimable_count: {
        description: "地域単位における推定不可件数",
      },
    },
  },
};
