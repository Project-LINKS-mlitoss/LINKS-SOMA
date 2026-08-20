/**
 * ガイド（チュートリアル）の復元ペイロード（tutorial_state.resume_state の $type）。
 *
 * stage で判別する discriminated union。linear 進行のため、保持するのは現 stage 1 つ分。
 * 名寄せ stage は draft_job_id 列で参照を持つため、ここには現れない。
 * route 文字列でなく構造化 id を保持し、UI 側で route を再構成する（ADR-0024）。
 *
 * model / evaluation の詳細フィールドは autosave 実装時に確定する。現段階では
 * 「DB 参照 id・パス・閾値などシリアライズ可能な選択値のみ」という制約だけ満たす。
 */
export type TutorialResumeState =
  | {
      stage: "normalization";
      /** ウィザードの該当ステップ（draft 参照は tutorial_state.draft_job_id 列が持つ） */
      step: number;
      /**
       * 現在ステップの種別。ガイドのステップ別コーチング（ウィザード内で今どの入力かを案内）に使う。
       * 旧データ互換のため任意。ステップ index は目的で並び替わるため、意味は index でなく種別で持つ。
       */
      stepType?: "intro" | "settings" | "dataset" | "confirmation";
      /** dataset ステップの対象データ表示名（コーチングで対象名を名指しするために持つ）。 */
      stepTitle?: string;
    }
  | {
      stage: "model";
      /** 選択した名寄せ済みデータセットの id（未選択は null） */
      datasetId: number | null;
      /** 選択した説明変数 */
      variables: string[];
    }
  | {
      stage: "evaluation";
      /** 推定フォームの選択値（DB 参照 id・パス・閾値等）。詳細は autosave 実装時に確定 */
      formValues: Record<string, unknown>;
    }
  | {
      stage: "analysis";
      workbookId: number;
      sheetId: number | null;
      viewId: number | null;
    };

/**
 * ガイドが参照する各工程の成果物の「現在の名前」（ADR-0024）。
 *
 * コピー保存はせず、参照ジョブ id から保存先テーブルを都度引いて得る（rename 追従・SSOT）。
 * 未保存・未作成は null。renderer/main 双方から使うため shared に置く。
 */
export type GuideNames = {
  normalization: string | null;
  model: string | null;
  evaluation: string | null;
};
