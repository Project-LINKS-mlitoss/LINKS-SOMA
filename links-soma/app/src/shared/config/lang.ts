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
        label: "① 名寄せ処理済データから選択",
        description: `空き家推定確率を推定するモデルを構築するため、「名寄せ処理済データ」を選択します。名寄せ済みのデータが無い場合には、「名寄せ処理」を実施してください。`,
      },
      subtitle2: {
        label: "② 説明変数に使うカラムの選択",
        description: `①で名寄せ処理済データを選択すると、説明変数に使うカラムを選択できます。名寄せ処理済みデータのうち、説明変数に必ず使うカラムはすでに選択されます。それ以外に空き家推定に使いたい情報があれば、カラムを選択してください。

※「説明変数」とは、機械学習によって空き家推定確率を推定するための情報のことです。
（例）「水道閉開栓状態と水道使用量から、空き家かどうかを推定したい」 → 「水道開閉栓状況」と「水道使用量」を説明変数として選択します。`,
      },
      validation: {
        datasetRequired: "名寄せ処理済データを選択してください",
        explanatoryVariablesRequired:
          "説明変数に使うカラムを1つ以上選択してください",
      },
    },
    "evaluation/create": {
      subtitle1: {
        label: "利用するモデルを選択",
        description: `空き家推定確率の推定に使うモデルを選択してください。`,
      },
      subtitle2: {
        label: "推定対象のデータを選択",
        description: `空き家推定確率を推定したい時点の名寄せ処理済みデータセットを選択してください。名寄せ処理済みデータセットが無い場合には、「名寄せ処理」から処理を実行してください。`,
      },
      subtitle3: {
        label: "地域集計用データを選択",
        description: `国勢調査（町丁・字等別境界データ）、小学校区、都市計画図等、空き家推定の結果を任意の地域・区域で集計する単位となるデータを選択してください。データの作成方法等については、操作マニュアルを参照してください。`,
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
        // 地域集計（③）は条件付きで非表示になるため番号を付けない。①②③は入力ステップ、
        // 高度な設定は任意の設定パネルで番号シーケンスに含めない（issue #1924）。
        label: "高度な設定",
        description: `モデルが算出した空き家推定確率（0%〜100%）をもとに、最終的な予測結果（「空き家」か「非空き家」）を分けるための閾値を設定できます。閾値は推定処理後の分析画面から変更することもできます。
`,
      },
      settingsThreshold: {
        label: "空き家推定確率の閾値",
        modelAppliedNotice:
          "選択したモデルに適した推奨閾値を適用しました。必要に応じて調整できます。",
        modelMissingNotice:
          "選択したモデルには推奨閾値がないため、既定値を使用します。必要に応じて調整できます。",
      },
      validation: {
        datasetRequired: "推定対象のデータを1件以上選択してください",
        modelRequired: "利用するモデルを選択してください",
        areaGroupingRequired: "地域集計用データを選択してください",
      },
    },
  },
  components: {
    // エラー表示（FR006 / #1786）。失敗時の「対応区分」「修正方法」の職員向け文言を集約。
    errorDisplay: {
      // 責任分界の見出し。職員視点で「誰が直すか」でなく「どう対応するか」を示す。
      actionLabel: "対応:",
      // 失敗バナー（ジョブ失敗時）と警告バナー（成功したが確認事項あり）のタイトル。
      postErrorTitle: "処理に失敗しました。",
      postWarningTitle: "確認事項があります。",
      fixGuideToggle: "修正方法を見る",
      fixGuideClose: "修正方法を閉じる",
      acceptedLabel: "正しい形式:",
      exampleLabel: "修正例:",
      // 責任分界（network SSOT 値）→ 職員向けの対応区分の表示文言。
      action: {
        自治体修正: "データの修正",
        開発者に相談: "開発元へ連絡",
        状況依存: "データ・設定の確認",
      } as Record<string, string>,
    },
    // 対話的閾値調整（FR022）。境界付近の建物へのフィードバックから閾値を提案する。
    "threshold-assistant": {
      openButton: "閾値を調整する",
      dialogTitle: "閾値の調整",
      feedbackVacant: "空き家として扱う",
      feedbackNot: "空き家として扱わない",
      suggestedLabel: "おすすめの閾値",
      reapplyHeading: "反映方法",
      applyColumn: "この閾値で表示を更新",
      applyColumnHint:
        "推定はやり直さず、表示する閾値だけ切り替えます（すぐ反映）。",
      applyRerun: "推定を再実行して反映",
      applyRerunHint:
        "この閾値と同じデータ・モデルを引き継いで推定作成画面を開きます。内容を確認して「推定開始」を押すと再実行されます。",
      applyRerunUnavailableHint:
        "この推定結果は元の入力（モデル・データ）を復元できないため、再実行できません（CSV読み込みで作成された結果など）。表示の閾値切り替えはご利用いただけます。",
      close: "閉じる",
      // 二分探索フロー用の文言
      introBinary:
        "空き家として扱う範囲の境界（閾値）を、実際の建物を見ながら決めます。数件ずつの回答を繰り返して候補を絞り込みます。",
      stepHeading: "推定確率 {prob}% 付近の建物",
      // {prob} は確率帯、{count} は実際の表示件数（確率帯が薄いと PROBE_SIZE 未満になる）。
      judgePrompt:
        "{prob}% 付近の建物から {count} 件を表示しています。これらの建物のうち空き家として扱えそうなものを選択してください。回答に応じて、次に確認する確率帯が変わります。",
      // 件数は書かない（確率帯が薄いと表示件数が PROBE_SIZE 未満になる）。
      majorityHint:
        "表示された建物のうち、多い方の回答で次に確認する確率帯を決めます。",
      back: "ひとつ戻る",
      restart: "やり直す",
      next: "次へ",
      // resultHeading は既存 suggestedLabel（"おすすめの閾値"）と重複のため追加しない
      noVacant:
        "境界付近で「空き家として扱う」と回答された建物がありませんでした。閾値は据え置きます。",
      progress: "{step} 回目の判定",
      loading: "建物を読み込み中...",
      noData: "対象データの建物が見つかりませんでした。",
    },
    // 各処理画面の冒頭コールアウト（この処理は何か・何をするか）。ガイド全体説明より具体的に。
    processIntro: {
      normalization:
        "名寄せは、住民・水道・建物などの複数のデータを住居単位で1つに統合する処理です。表記ゆれを補正し、モデル構築・推定で使える形に整えます。",
      model:
        "モデル構築は、名寄せ処理済みデータから「空き家らしさ」を学習し、判定モデルを作る処理です。説明変数に使うカラムを選んで実行します。",
      evaluation:
        "空き家推定は、モデルを使って、推定対象データの全建物に空き家推定確率（0〜100%）を付与する処理です。",
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
        description: "名寄せ処理対象市区町村名と基準日を設定してください。",
      },
      settingsReferenceDate: {
        // 既定の説明文。表示は descriptionByPurpose を目的で解決して使うが、
        // この description は normalizationParameters[key].description の
        // インデックスアクセス型契約（全メンバが description を持つ）を満たすため必須。
        description:
          "空き家確率を推定したい時点を設定してください。異なる時点での推定を行いたい場合は、その都度、基準日を変えて名寄せ処理を実行してください。",
        descriptionByPurpose: {
          vacancy_estimation:
            "空き家確率を推定したい時点を設定してください。異なる時点で推定を行いたい場合は、その都度、基準日を変えて名寄せ処理を実行してください。",
          model_training:
            "モデルの教師データとなる空き家調査結果の調査時点に最も近い日付を設定してください。",
        },
      },
      settingsMunicipality: {
        description:
          "名寄せ処理の対象となる市区町村名を入力してください。名寄せ処理で住所を照合する際に利用します。都道府県名は含めないでください。",
        placeholder: "市区町村名を入力",
        suffixNote:
          "末尾が「市」「区」「町」「村」で終わるように入力してください",
      },
      wizardIntro: {
        label: "はじめに",
        description: "目的を選び、必要なデータを確認します。",
        // 概念説明（名寄せとは）は h2 直下の ProcessIntro に一本化（重複排除）。

        // 名寄せの目的（空き家推定 / AIモデル構築）を選ばせる。目的で必要データが変わる。
        approachTitle: "名寄せ処理の目的",
        approachLead:
          "名寄せの目的を選んでください。目的に応じて用意するデータが変わります。",
        // intro カードの見出し。テーブル・確認・チップ用の短ラベル（normalizationPurpose.label）
        // とは別に、ここでは「何のための名寄せか」を用途明示する。
        approachGenericTitle: "空き家推定用の名寄せ処理",
        approachCustomTitle: "AIモデル構築用の名寄せ処理",
        needsLabel: "必要なデータ",
        // 共通の補足（両方に共通）。
        approachOptionalNote: "任意データで精度を高められます",
        approachGenericBody:
          "構築済のモデルで推定するためのデータを作成します。",
        approachGenericNeeds: "必須データ",
        approachCustomBody:
          "地域のデータで独自モデルを構築するためのデータを作成します。空き家調査結果が必須です。",
        approachCustomNeeds: "必須データ",
        // AIモデル構築用で追加で必須になるデータ（空き家調査結果）。
        approachCustomExtra: "空き家調査結果",

        // 用意するデータの全体一覧。比較カード内の「必要なデータ」とは語を分ける。
        dataTitle: "用意するデータ",
        uploadPrefix: "データは",
        datasetManagementLink: "データセット管理",
        uploadSuffix: "からまとめてアップロードできます。",
        requiredGroupTitle: "必須データ",
        requiredGroupNote: "選択した目的で必ず必要です。",
        optionalGroupTitle: "任意データ",
        optionalGroupNote:
          "必須ではありませんが、推定精度の向上・集計単位の変更・分析に使えます。",
        // job-parameters-section など他画面が参照する汎用ラベル。
        requiredSection: "必須データ",
        optionalSection: "任意データ",
      },
      wizardConfirmation: {
        label: "確認",
        description: "入力内容を確認して処理を開始します",
      },
    },
    // 前回の名寄せ実行のカラム設定を当該データセットへ適用する導線（#1782）。
    // parameter label 群（normalizationParameters）とは別系統のため兄弟に置く。
    normalizationApplyPreviousMapping: {
      sectionTitle: "前回の名寄せで使ったカラム設定",
      applyLabel: "前回のカラム設定を適用",
      // 直後に実行日（YYYY/MM/DD）を続ける。
      lastRunPrefix: "前回実行: ",
      appliedLabel: "適用しました",
    },
    // 名寄せの目的（空き家推定 / AIモデル構築）。
    // キーは use-form-normalization の NormalizationPurpose に対応。
    normalizationPurpose: {
      // 目的の項目ラベル（一覧の列・確認・ジョブ詳細で共通利用）。
      fieldLabel: "目的",
      // 目的が未記録（既存データ等）の表示。
      unknownLabel: "—",
      vacancyEstimation: {
        label: "空き家推定",
        shortLabel: "空き家推定",
      },
      modelTraining: {
        label: "AIモデル構築",
        shortLabel: "AIモデル構築",
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
          "家屋単位の水道使用量を示すデータ。基準日から遡って1年分のデータを用意してください（基準日より未来日を入れるとエラーになります）。",
      },
      buildingRegistry: {
        label: "登記情報",
        description:
          "家屋単位の建築年や構造、相続情報を示すデータ。「登記簿」から作成される情報を入力することで精度向上が期待できます。",
        descriptionByPurpose: {
          vacancy_estimation:
            "家屋単位の建築年や構造、相続情報を示すデータ。\n\n汎用モデルで推定を行う場合は、本データは空き家推定には使われませんが、推定結果と紐づけて分析や可視化に利用できます。\n\n登記情報を学習したモデルで推定を行う場合は、本データを空き家推定に利用できます。",
          model_training:
            "家屋単位の建築年や構造、相続情報を示すデータ。モデル構築の工程において、本データから取得できる情報をモデルの説明変数として利用できます。",
        },
      },
      buildingTypeDetermination: {
        label: "処理対象選定用データ",
        description:
          "推定対象とする家屋の種別を指定するデータ。指定した種別の家屋を推定対象とすることができます。このデータを入れない場合は、全ての家屋は「種別不明」として扱われ推定の対象となります。",
        descriptionByPurpose: {
          vacancy_estimation:
            "推定対象とする家屋の種別を指定するデータ。指定した種別の家屋を推定対象とすることができます。このデータを入れない場合は、全ての家屋は「種別不明」として扱われ推定の対象となります。",
          model_training:
            "学習対象とする家屋の種別を指定するデータ。指定した種別の家屋を学習の対象とすることができます。入力しない場合、全ての家屋は「種別不明」として扱われ学習の対象となります。",
        },
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
        descriptionByPurpose: {
          vacancy_estimation:
            "空き家の住所一覧を含むデータ。分析の工程において、既知の空き家であることを識別・可視化するためのデータとして利用されます。",
          model_training:
            "空き家の住所一覧を含むデータ。モデル構築の工程において、モデルの教師データとして使用されます。",
        },
      },
      optionalDataSource: {
        label: "建物関連データ",
        description:
          "名寄せ結果に追加したい説明変数を含むCSVデータ。住所カラムで名寄せされ、全カラムが説明変数の候補として出力に追加されます。",
        descriptionByPurpose: {
          vacancy_estimation:
            "建物に紐づく各種情報を示すデータ。\n\n汎用モデルで推定を行う場合は、本データは空き家推定には使われませんが、推定結果と紐づけて分析や可視化に利用できます。\n\n建物関連データを学習したモデルで推定を行う場合は、本データを空き家推定に利用できます。",
          model_training:
            "建物に紐づく各種情報を示すデータ。モデル構築の工程において、本データに含まれるすべてのカラムをモデルの説明変数として利用できます。",
        },
      },
    },
    // データチェック（軽量バリデーション）のメッセージ。検出器（ドメイン）は messageKey と
    // 差し込み値だけを返し、文章はここで一元管理する（{value} 等は実行時に差し込む）。
    normalizationPreValidation: {
      // 画面ラベル（行の「種類」列）。内部の観点名（一意性・参照整合等）でなく、
      // 利用者に馴染む平易語を出す。種類＝ラベル / 具体＝メッセージで役割を分ける。
      // キー = AspectId（参照整合のみ "reference"、文字コードのみ "encoding"）。
      labels: {
        uniqueness: "重複",
        data_type_numeric: "数値",
        value_range: "範囲",
        missing_value: "空欄",
        date_format: "日付",
        reference: "ひも付け",
        encoding: "文字コード",
        date_order: "日付の前後",
      },
      messages: {
        // 重複（PV-07・一意性）。種類はラベル「重複」が担い、メッセージは具体を出す。
        uniquenessDuplicate: "「{value}」が複数の行にあります",
        // unknown 群は「サンプル内に〜なし」でサンプル検査であることを示す（全件は実行時確定・末尾の定型は冗長のため省く）
        uniquenessUnknown: "サンプル内に重複なし",
        uniquenessClear: "重複なし",
        // 数値（PV-04）／範囲（PV-05）／日付（PV-09）
        numericInvalid: "「{value}」は数値として読めません",
        valueRangeOut: "「{value}」が範囲（{min}〜{max}）外です",
        dateFormatInvalid: "「{value}」を日付として読めません",
        // 上記3観点（不正値検出）の共通 unknown
        noMatchUnknown: "サンプル内に該当なし",
        // 空欄（PV-06・必須欠損なし）
        missingValueDetected: "空の行があります",
        missingValueUnknown: "サンプル内に欠損なし",
        // ひも付け（PV-08・参照整合・クロスファイル）
        referenceParentMissing:
          "参照整合の確認に使うキー列が取得できませんでした",
        referenceNotFound: "「{value}」に対応する行が参照先にありません",
        referenceClear: "参照不整合なし",
        referenceUnknown: "サンプル内に参照不整合なし",
        // 文字コード（PV-01・ファイル単位）
        encodingNotUtf8:
          "UTF-8として読めない文字があります。文字コードを確認してください",
        // 日付の前後（PV-10・2カラム同一行。どの2列かは column 欄に表示）
        dateOrderReversed:
          "本来は後になる日付が、前の日付より過去になっています（{earlier} → {later}）",
        dateOrderUnknown: "サンプル内に前後の逆転なし",
      },
      // パネル自体の実行失敗（ファイル読込・パース等）。事前は目安なので非ブロッキング。
      panelError:
        "データチェックを実行できませんでした。処理実行時に再確認されます",
      // パネルの見出し・サマリ・畳み込み行。{count} は件数。
      panel: {
        // タイトルに検査範囲を入れる（全件チェックと誤解されないため）。詳細は sampleNote。
        title: "データチェック（一部のデータを対象）",
        summaryError: "エラー {count} 件",
        summaryAttention: "要確認 {count} 件",
        summaryOk: "問題なし",
        // 発見された問題のみを表に出す。列ヘッダー（カラム / 種類 / 内容）。
        colHeaderColumn: "カラム",
        colHeaderType: "種類",
        colHeaderDetail: "内容",
        // サンプル目安の但し書き（表の下に1回だけ）。
        sampleNote:
          "一部のデータを対象にチェックしています（全件のチェックは、名寄せ処理実行時に行われます）",
        // 問題が1件も見つからなかったとき。
        noFindings:
          "一部のデータを対象にチェックした結果、問題は確認されませんでした（全件のチェックは、名寄せ処理実行時に行われます）",
      },
    },
    "form-normalization": {
      validation: {
        datasetRequired: "必須データセットのファイルを選択してください",
        columnRequired: "カラムを割り当ててください",
      },
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
    // 名寄せ処理の処理結果画面が出す内訳の語彙。画面と検証情報ダウンロードの
    // 両方が参照する。片方だけラベルが変わると、同じ数値が別名で流通するため。
    preprocessSummary: {
      totalCountSection: "名寄せ処理済データ（推定対象）の総件数",
      totalCountLabel: "件数",
      breakdownHeading: "名寄せ処理済データの内訳",
      recordCombinationSection: "レコードの組み合わせ別",
      // 組み合わせを1行で表すときの略称（例: `水道+住基`）。表の列見出しは別に持つ
      waterSupply: "水道",
      jukiRegistry: "住基",
      toukiRegistry: "登記",
      // どのデータも持たない組み合わせ
      noRecord: "なし",
      waterSupplyColumn: "水道開閉栓状況",
      jukiRegistryColumn: "住民基本台帳",
      toukiRegistryColumn: "登記情報",
      typeColumn: "種別",
      percentageColumn: "構成比",
      hasData: "あり",
      noData: "なし",
      buildingTypeSection: "家屋種別",
      buildingTypeUserSpecified: "ユーザーが指定した種別",
      buildingTypeUnknown: "種別不明",
      mapDisplaySection: "地図表示別",
      mapDisplayWithPolygon: "建物ポリゴン表示",
      mapDisplayWithoutPolygon: "ポイント表示",
      mapDisplayExcluded: "表示対象外（座標なし）",
    },
    // モデル構築の処理結果画面が出す評価指標の語彙。画面と検証情報ダウンロードの
    // 両方が参照する。ツールチップの解説文は画面専用のため各コンポーネントが持つ。
    modelResult: {
      modelSection: "モデル",
      modelFileName: "モデルファイル名",
      modelFileNote: "メモ",
      precisionSection: "Precision@K（上位K件中の空き家割合）",
      liftSection: "Lift（ランダム抽出比）",
      // Precision@K・Lift の行ラベル（例: `上位1,000件`）
      topK: (k: number): string => `上位${k.toLocaleString()}件`,
      thresholdSection: "判定ライン",
      recallTarget: "再現率目標",
      thresholdScore: "判定閾値スコア",
      candidateCount: "候補件数",
      candidateRatio: "候補割合",
      importantColumnsSection: "特徴量重要度",
      // 説明変数が多いと上位のみに絞られるため、件数を見出しへ添える
      importantColumnsSectionTopN: (count: number): string =>
        `特徴量重要度（上位${count}件を表示）`,
    },
    "job-parameters-section": {
      heading: "実行情報",
      modelFile: "モデルファイル",
      // 推定ジョブが使った空き家推定確率の閾値（`ResultParameters.settings.threshold`）
      threshold: "しきい値",
      normalizedDataset: "名寄せ処理済データ",
      explanatoryVariables: "説明変数",
      processingTime: "処理時間",
      downloadVerification: "検証情報をダウンロード",
      downloadFilePrefix: "検証情報",
      downloadLogHeading: "実行ログ（開発者向け詳細）",
      durationTotalReal: "処理全体（実時間）",
      durationBreakdownToggle: "内訳",
      durationSetup: "起動・準備",
      durationProcess: "プロセス内処理（E021）",
      durationTrainingNested: "うちモデル学習（PU Bagging）",
      // 段階別（名寄せ・推定）の入れ子親ラベル。モデル構築の E021 注記を含まない汎用名
      durationProcessAll: "プロセス内処理",
      // 段階別処理時間のラベル。Python が返す段階キーから解決する。
      // 用語は docs/spec のモジュール名称に準拠（record_linkage は単一公式名がなく
      // spec のログ表現「住所で結合」に基づく）
      stageLabels: {
        record_linkage: "住所結合",
        e016: "空間結合",
        e015: "建物種別判定結合",
        e022: "空き家分類",
        e032: "地域集計",
      } as Record<string, string>,
      columnMapping: "カラム対応",
      joiningRateSection: "結合率",
      estimationResultSection: "推定結果",
      estimationResultCount: "推定結果件数",
      estimationResultFileName: "推定結果ファイル名",
      // 検証情報DL（NR007）の推定側セクション。画面の実行情報カードと同じ並びで出す
      usedDataSection: "利用データ",
      // 確率帯別の件数（#1987）。検証情報DL専用で画面には表示しない
      probabilityBinSection: "確率帯別の件数",
      probabilityBinScope: "集計範囲",
      probabilityBinScopeMultiYear: (datasetCount: number): string =>
        `複数年度の合算（名寄せ処理済データ ${datasetCount} 件）`,
      // エラー内容（FR006）。画面の赤いボックスに出ている情報を検証情報DLへ写す
      errorSection: "エラー",
      errorMessage: "エラー内容",
      errorResponsibility: "対応",
      errorNextAction: "次のアクション",
      errorFixGuide: "修正方法",
      errorFixGuideAccepted: "正しい形式",
      errorFixGuideExample: "修正例",
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
      // ジョブの状態。検証情報ファイル単体で、完了した処理の内容か実行途中の内容かを
      // 判別できるようにする。実行中に押されたファイルは以降の値が確定していない
      jobStatusSection: "実行結果",
      jobStatusLabel: "状態",
      jobStatusLabels: {
        complete: "完了",
        error: "失敗",
        draft: "下書き",
        processing: "実行中（この時点までの途中経過）",
      } as Record<string, string>,
      // 失敗したが詳細な記録を持たないジョブ。画面の「不明のエラーが発生しました」に対応。
      // 行を出さないとファイル上から失敗の事実そのものが消える
      errorUnknown: "不明のエラーが発生しました（詳細な記録なし）",
      // 名前をつけて保存した名寄せ処理済データの名前
      savedDataset: "保存済みデータセット名",
      // 建物関連データが名寄せ結果へ追加したカラム。何の情報を足したかを示す
      odsColumnsSection: (count: number): string => `追加カラム（${count}件）`,
      // 処理対象選定用データで家屋種別を絞っていない状態。空欄と区別する
      buildingTypeValuesNone: "指定なし（全ての家屋が種別不明として対象）",
    },
    "view-preset": {
      addButton: "ビューを追加",
      dialogTitle: "ビューを追加",
      blankOption: "空から作る",
      blankMemo: "白紙のビューを1つ作成して編集します",
      next: "次へ",
      back: "戻る",
      apply: "追加する",
      cancel: "キャンセル",
      close: "閉じる",
      loading: "読み込み中...",
      dataStepTitle: "データを選択",
      dataStepHint:
        "追加するビューのもとにする推定結果データを選んでください。",
      dataSelectLabel: "データセットを選択",
      dataUntitled: "タイトルなし",
      noDataSetResult:
        "適用できる推定結果データがありません。先に空き家推定を実行してください。",
      kindSystem: "SOMA提供",
      kindUser: "保存済み",
      viewsUnit: "ビュー",
      // テンプレート保存（ユーザーが現在のシートのビュー群を名前付きで保存）。
      saveButton: "テンプレートとして保存",
      saveDialogTitle: "テンプレートとして保存",
      saveNameLabel: "テンプレート名",
      saveNamePlaceholder: "例：今年度調査対象候補一覧",
      descriptionLabel: "説明（任意）",
      descriptionPlaceholder: "例：地域単位で空き家件数と推定確率を俯瞰する",
      save: "保存",
      saveEmpty: "保存できるビューがありません。先にビューを追加してください。",
      // 保存ボタンが無効なときの理由（変更がない＝再保存不要）。
      saveNoChanges: "ビューの設定を変更すると保存できます。",
      // 保存完了フィードバック（ダイアログ内に成功表示を残す。Gulf of Evaluation を埋める）。
      saveSuccess: "「{name}」をテンプレートとして保存しました。",
      saveSuccessHint:
        "「ビューを追加」の一覧から、別シート・別ワークブックでも再利用できます。",
      // ユーザーテンプレートの編集（追加ダイアログ内。名前・説明を編集）。
      templateActions: "テンプレートの操作",
      renameTitle: "テンプレートを編集",
      rename: "編集",
      renameSave: "変更を保存",
      deleteTemplate: "削除",
      deleteConfirmTitle: "テンプレートを削除しますか？",
      deleteConfirmBody:
        "削除すると、このテンプレートは「ビューを追加」の一覧から消えます。作成済みのビューは消えません。",
      delete: "削除する",
    },
    // 名寄せ下書きの確認ダイアログ（続行 / 新規作成）。
    draftConfirm: {
      title: "下書きがあります",
      // 通常: 下書きを破棄して新規作成する確認。
      body: "保存された下書きがあります。続けて編集しますか？\n新規作成を選択すると、下書きは削除されます。",
      // ガイド参照中: 新規作成は下書き削除に加えガイド進行のリセットも伴う。重さを 1 枚で伝える。
      bodyGuideReferenced:
        "この下書きはガイドで使用中です。\n新規作成すると下書きが削除され、ガイドの進行もリセットされます。",
      // モデル構築画面の導線（新規開始専用）。続ける（既存下書きの再開）は提示せず、新規作成かキャンセルのみ。
      bodyModelTraining:
        "作成途中の名寄せ処理があります。\nAIモデル構築用の名寄せ処理を新しく始めると、この下書きは削除されます。",
      newCreate: "新規作成",
      continue: "続ける",
      cancel: "キャンセル",
    },
    tutorial: {
      launchTitle: "ガイドを始めますか？",
      launchBody:
        "名寄せ → モデル構築 → 空き家推定 → 分析 の流れを順番にご案内します。各工程の入力と実行を、つまずかずに最後まで進められます。",
      // 起動ダイアログ: 全体フローの各工程の一言説明（順番に表示）。
      launchFlowHeading: "このガイドで進める流れ",
      flowNormalization:
        "名寄せ：住民・水道・建物などの複数のデータを、住所をキーに住居単位で1つに統合し、分析できる形に整えます。",
      flowModel:
        "モデル構築：自治体のデータから、空き家を見分けるモデルを作ります。",
      flowEvaluation:
        "空き家推定：すべての建物に空き家推定確率（0〜100%）を付けます。",
      flowAnalysis: "分析：地図やグラフで推定結果を確認します。",
      // モデル構築の要否（開始時に選択。名寄せの必須データと工程数が変わる）。
      modelChoiceHeading: "モデルはどうしますか？",
      modelBuildLabel: "モデルを構築する",
      modelBuildDesc:
        "自治体のデータで精度を高めたモデルを作ります。名寄せで説明変数のデータが必要です。",
      modelGenericLabel: "汎用モデルを使う",
      modelGenericDesc:
        "モデル構築をスキップし、用意済みの汎用モデルで推定します。名寄せの入力項目が少なく済みます。",
      later: "あとで",
      begin: "始める",
      resumeTitle: "ガイドを再開しますか？",
      resumeBody: "「{label}」の工程で中断しています。続きから再開できます。",
      resumeBodyFallback:
        "前回のガイドが中断されています。続きから再開できます。",
      fromStart: "最初から",
      resume: "再開する",
      endTitle: "ガイドを終了しますか？",
      endBody:
        "終了すると現在の進行状態は破棄され、このガイドは再開できません。（新規に再度開始することは可能です）",
      cancel: "キャンセル",
      end: "終了する",
      completeTitle: "お疲れさまでした",
      completeBody:
        "ガイドを完了しました。推定結果を分析画面でご確認いただけます。",
      close: "閉じる",
      runningToggle: "ガイド進行中",
      // 右上常駐の入口ボタン（phase 別。running はトグルが担う）
      entryStart: "ガイド",
      entryResume: "再開",
      entryRestart: "もう一度",
      stepLabel: "工程",
      complete: "ガイドを完了する",
      pause: "中断",
      finish: "終了",
      guardTitle: "ガイドを終了して続けますか？",
      guardBody:
        "この下書きはガイドの進行で使用中です。このまま進めるとガイドの進行が失われ、再開できなくなります。",
      guardConfirm: "ガイドを終了して続ける",
      // 現工程の状態に応じたコーチング（実 UI を名指しで案内する）。
      // 状態はバッジが担い、本文は「次にやること（行動）」のみにする（2 セクション分離）。
      coach: {
        nextLabel: "次にやること",
        badgeDraft: "下書き",
        badgeProcessing: "処理中",
        badgeComplete: "完了",
        badgeError: "エラー",
        // 名寄せ（route 文脈・ジョブ状態で出し分け）
        // ウィザード内はステップ種別で出し分ける（下の normStep*）。normInWizard は種別が
        // 取得できない場合のフォールバック。
        normInWizard: "入力を進め、確認画面で「開始する」を押してください。",
        // ウィザードのステップ別コーチング。dataset は対象名を名指しし、取得方法・必要カラム等の
        // 詳細は右サイドパネル（設定のヒント / 取得方法・必要なカラム・注意）に委譲する（重複を作らない）。
        // 画面の内容（名寄せ処理の目的・用意するデータ）を確認させてから進めてもらう
        // （目的を既定のまま素通りさせない）。
        normStepIntro:
          "名寄せ処理の目的と、用意するデータを確認し、「次へ」で進んでください。",
        // build（モデルを構築する）時は既定の目的が「空き家推定用」のままだと教師データが
        // 揃わないため、目的の切り替えも明示的に促す。
        normStepIntroBuild:
          "「名寄せ処理の目的」で「AIモデル構築用の名寄せ処理」を選び、用意するデータを確認して、「次へ」で進んでください。",
        normStepSettings:
          "名寄せ処理対象の市区町村名と基準日（推定したい日付）を設定してください。「設定のヒント」も参考になります。",
        normStepDataset:
          "[[{title}]]のデータを「データセットを選択」から選び、必要なカラムを設定してください。右側の説明も参考にできます。",
        normStepConfirm: "入力内容を確認し、「開始する」を押してください。",
        normNotStarted:
          "最初の工程です。「名寄せ処理を始める」から名寄せを作成してください。",
        normDraftList: "入力途中の名寄せがあります。続きから入力してください。",
        // 動的な対象名（日時付きジョブ名・保存データ名）は [[…]] で囲み、UI 側でグレーの
        // チップ表示にする（コントラストで識別しやすく）。UI ラベルの 「」 はそのまま文字。
        normProcessing:
          "処理一覧の[[{time} の名寄せ処理]]で状況を確認できます。完了まで少しお待ちください。",
        normCompleteUnsaved:
          "一覧から[[{time} の名寄せ処理]]を開き、「名前をつけて保存」してください。",
        normCompleteSaved: "次の工程に進んでください。",
        normError:
          "[[{time} の名寄せ処理]]を開いて内容を確認し、「再実行へ」からカラムの選択などを修正して、もう一度実行できます。",
        // モデル構築（未実行は前工程の保存名を名指し、実行後は状態駆動）
        model:
          "「① 名寄せ処理済データから選択」で名寄せ[[{normalization}]]をインポートし、「② 説明変数に使うカラムの選択」で使うカラムを確認（必要に応じて追加）してから、「モデル構築開始」を押してください。",
        modelNoName:
          "「① 名寄せ処理済データから選択」で名寄せ済みデータをインポートし、「② 説明変数に使うカラムの選択」で使うカラムを確認（必要に応じて追加）してから、「モデル構築開始」を押してください。",
        modelProcessing:
          "処理一覧の[[{time} のモデル構築]]で状況を確認できます。完了まで少しお待ちください。",
        modelCompleteUnsaved:
          "[[{time} のモデル構築]]を開き、「名前をつけて保存」してください。",
        modelCompleteSaved: "次の工程に進んでください。",
        modelError:
          "[[{time} のモデル構築]]を開いて内容を確認し、「再実行」から設定を見直して、もう一度実行できます。",
        // モデル未実行・画面内のフィールド進捗（①データ→②カラム→開始）。総括(model)を段階に割る。
        modelStepDataset:
          "「① 名寄せ処理済データから選択」で、使う名寄せ済みデータをインポートしましょう。",
        modelStepVariables:
          "「② 説明変数に使うカラムの選択」で、使うカラムを確認しましょう（必要に応じて追加）。",
        modelStepStart: "内容を確認して「モデル構築開始」を押しましょう。",
        // 空き家推定（未実行は保存名を名指し、実行後は状態駆動。結果は自動保存のため確認→分析へ）。
        // 地域集計用データはジオメトリ源を持つデータでのみ表示される（#1924）。
        evaluation:
          "「推定対象」に名寄せ[[{normalization}]]、「モデル」に[[{model}]]、「地域集計用データ」を選び、「推定開始」を押してください。",
        evaluationNoName:
          "「推定対象」の名寄せ済みデータ、「モデル」、「地域集計用データ」を選び、「推定開始」を押してください。",
        // 汎用モデル利用時（モデル工程をスキップ）。「モデル」で汎用モデルを選ぶ。
        evaluationGeneric:
          "「推定対象」に名寄せ[[{normalization}]]、「モデル」に汎用モデル、「地域集計用データ」を選び、「推定開始」を押してください。",
        evaluationGenericNoName:
          "「推定対象」の名寄せ済みデータ、「モデル」で汎用モデル、「地域集計用データ」を選び、「推定開始」を押してください。",
        // 地域集計フォームが非表示と判明している場合（選択済みデータにジオメトリ源がない・#1924）。
        // 画面に出ない欄を案内しないよう、地域集計を落とした文面に差し替える。
        evaluationNoArea:
          "「推定対象」に名寄せ[[{normalization}]]、「モデル」に[[{model}]]を選び、「推定開始」を押してください。",
        evaluationNoAreaNoName:
          "「推定対象」の名寄せ済みデータ、「モデル」を選び、「推定開始」を押してください。",
        evaluationGenericNoArea:
          "「推定対象」に名寄せ[[{normalization}]]、「モデル」に汎用モデルを選び、「推定開始」を押してください。",
        evaluationGenericNoAreaNoName:
          "「推定対象」の名寄せ済みデータ、「モデル」で汎用モデルを選び、「推定開始」を押してください。",
        evalProcessing:
          "処理一覧の[[{time} の空き家推定]]で状況を確認できます。完了まで少しお待ちください。",
        evalComplete:
          "[[{time} の空き家推定]]を開いて結果を確認し、分析へ進んでください。",
        evalError:
          "[[{time} の空き家推定]]を開いて内容を確認し、「空き家推定画面へ」から設定を見直して、もう一度実行してください。",
        // 推定未実行・画面内のフィールド進捗（推定対象→モデル→地域集計→開始）。モデルは modelMode で分岐。
        // 地域集計は表示時のみ案内する（非表示＝ジオメトリ源なしのときは飛ばす。#1924）。
        evalStepTarget:
          "「推定対象」に、分析したい名寄せ済みデータを選びましょう。",
        evalStepModel: "「モデル」に、構築したモデルを選びましょう。",
        evalStepModelGeneric: "「モデル」で「汎用モデル」を選びましょう。",
        evalStepAreaData: "「地域集計用データ」を選びましょう。",
        evalStepStart: "内容を確認して「推定開始」を押しましょう。",
        // 分析（最終工程・ジョブなし）。範囲はビュー作成まで。進捗3段階で出し分ける:
        // ①未着手=WB作成 ②WB内・ビュー未作成=プリセットでビュー作成 ③作成済み=完了。
        // 着地画面のボタン名（操作マニュアル準拠）に合わせる。
        analysis:
          "「新規ワークブック作成」で分析用のワークブックを作りましょう。推定結果[[{evaluation}]]を地図やグラフで可視化できます。",
        analysisNoName:
          "「新規ワークブック作成」で分析用のワークブックを作りましょう。推定結果データを地図やグラフで可視化できます。",
        analysisAddView:
          "「ビューを追加」からプリセット（例:「地域別の空き家分布」）を選び、推定結果データを適用すると、おすすめ構成のビューが作成されます。",
        analysisViewReady:
          "ビューができました。これで分析の準備は完了です。ポップオーバーの「ガイドを完了する」で終了できます。",
        // 主アクションのラベル
        actionOpen: "この工程を開く",
        actionContinue: "続きから入力する",
        actionViewList: "処理一覧で確認する",
        actionViewError: "エラーを確認する",
        actionViewResult: "結果を確認する",
        actionSave: "保存へ進む",
        // 次工程へ。遷移先を名指しする（本文は汎用なので重複しない）。
        actionOpenNext: "「{label}」を開く",
      },
    },
    resultView: {
      // ビュー設定の前提条件案内。エラーではなく、緯度・経度の供給源（名寄せ処理の
      // 「ジオコーディングデータ」）を名指しして、ユーザーが次に取る操作を判断できるようにする。
      // 緯度経度の唯一の供給源はこのデータセットの住所結合（IF001）なので、未選択・結合失敗の
      // 両方を案内に含める。位置情報なしの推定自体は容認している。
      positionRequiredTitle:
        "このビューには位置情報（ジオコーディング）が必要です",
      positionRequiredBody:
        "「ジオコーディングデータ」を追加した名寄せ済みデータから作成した推定結果を選んでください。追加済みでも表示されない場合は、名寄せ処理結果の結合率をご確認ください。",
      // ラベルのグループは上から順に判定し、最初に一致した条件のグループに入る。
      // 条件が重複しうる（例: 「東町を含む」と「南東町を含む」）ため、順序が集計結果を決める。
      // 順位は数字で重ねず、移動ボタンの並びで示す。
      // 円グラフはラベルのグループがないと1行が1扇形になり、内訳の図として成立しない。
      // エラーではなく設定が未完了なだけなので、位置情報の案内と同じ控えめな表示にする。
      pieGroupRequiredTitle: "この円グラフにはラベルのグループが必要です",
      pieGroupRequiredBody:
        "ビュー編集パネルの「ラベルのグループを追加」から、可視化したい区分を設定してください。設定するまでグラフは表示されません。",
      labelGroupUnmatchedNote:
        "どの条件にも一致しないデータはグラフに表示されません。",
      labelGroupMoveUp: "優先順位を上げる",
      labelGroupMoveDown: "優先順位を下げる",
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
          "モデル構築および空き家推定における基準とする年月日。「名寄せ処理」において設定した基準日を示す。",
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
      predicted_probability_change_rate_from_previous: {
        description:
          "ひとつ前の推定日と比べた空き家推定確率の増減。プラスは増加、マイナスは減少を示す。比較できる推定日がない建物は算出対象外。",
      },
      predicted_probability_change_rate_from_oldest: {
        description:
          "最も古い推定日と比べた空き家推定確率の増減。プラスは増加、マイナスは減少を示す。比較できる推定日がない建物は算出対象外。",
      },
      predicted_label: {
        description:
          "空き家推定の結果、「空き家かどうか」を空き家推定の際に設定したしきい値を基準に判定したフラグ。非空き家は「0」、空き家は「1」で示す。しきい値は推定の実行時に設定し、選択したモデルに推奨閾値があればその値、無ければ0.45が初期値として入る。",
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
      building_age_years: {
        description:
          "築年数。基準日（推定日）から最古の登記日付までの満年数。登記情報データから算出される。",
      },
      years_since_inheritance: {
        description:
          "相続後経過年数。基準日（推定日）から直近の相続日までの満年数。該当が無ければ空。",
      },
      years_since_extension: {
        description:
          "増築後経過年数。基準日（推定日）から直近の増築日までの満年数。該当が無ければ空。",
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
※空き家推定結果：空き家推定の結果、「空き家かどうか」を空き家推定の際に設定したしきい値を基準に判定したフラグ。非空き家は「0」、空き家は「1」で示す。しきい値は推定の実行時に設定し、選択したモデルに推奨閾値があればその値、無ければ0.45が初期値として入る。`,
      },
      unestimable_count: {
        description: "地域単位における推定不可件数",
      },
    },
  },
};
