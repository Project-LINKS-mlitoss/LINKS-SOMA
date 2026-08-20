import { type RefObject } from "react";
import { useForm, type UseFormReturn, type Resolver } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { lang } from "../../../shared/config/lang";

const validation = lang.pages["evaluation/create"].validation;

// 推定の入力。model と名寄せデータは常に必須。地域集計（area_grouping）は
// 建物ジオメトリ源を持つデータでのみ表示・必須化するため、ここでは path を必須にしない
// （表示時の必須化は下の withAreaGroupingRequired が担う）。issue #1924
export const schema = z.object({
  model_path: z.string().min(1, validation.modelRequired),
  normalized_dataset_paths: z
    .array(z.string())
    .min(1, validation.datasetRequired),
  settings: z.object({
    threshold: z.number(),
  }),
  area_grouping: z.object({
    path: z.string(),
    columns: z.object({
      area_group_id: z.string(),
      area_group_name: z.string(),
    }),
  }),
});

type FormType = z.infer<typeof schema>;

// 地域集計フォーム表示時に area_grouping.path を必須にする追加検証。
export const withAreaGroupingRequired = schema.superRefine((data, ctx) => {
  if (data.area_grouping.path.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["area_grouping", "path"],
      message: validation.areaGroupingRequired,
    });
  }
});

const resolverRequired = zodResolver(withAreaGroupingRequired);
const resolverOptional = zodResolver(schema);

/**
 * 空き家判定閾値のフォーム既定値（0〜1スケール）。
 * モデル未選択時、および選択モデルに推奨閾値が無い場合のフォールバック値。
 */
export const DEFAULT_EVALUATION_THRESHOLD = 0.45;

/**
 * 推定作成画面へ prefill 遷移する際の router state（FR022 対話的閾値調整の再実行）。
 *
 * threshold は 0〜1 スケール（フォームの settings.threshold と同じ）。
 * 呼び出し側（threshold-assistant）が % を /100 して渡す。
 * create 画面はこの state を検出したらフォームを reset() で上書きする。
 * 表示ラベル（モデル名・ファイル名）はパスの basename から create 画面側で導出する。
 */
export type EvaluationPrefillState = {
  evaluationPrefill: {
    form: FormType;
  };
};

export const useFormDataEvaluation = (
  /**
   * 地域集計フォームを表示中か。表示時のみ area_grouping.path を必須にする。
   * 表示状態は選択データのジオメトリ源有無に依存し、フォーム生成後に確定するため、
   * ref 経由で検証時に最新値を読む（未指定時は従来どおり必須）。
   */
  requireAreaGroupingRef?: RefObject<boolean>,
): UseFormReturn<FormType> => {
  const resolver: Resolver<FormType> = (values, context, options) => {
    const activeResolver =
      requireAreaGroupingRef?.current === false
        ? resolverOptional
        : resolverRequired;
    return activeResolver(values, context, options);
  };
  return useForm<FormType>({
    resolver,
    defaultValues: {
      model_path: "",
      normalized_dataset_paths: [],
      settings: {
        threshold: DEFAULT_EVALUATION_THRESHOLD,
      },
      area_grouping: {
        path: "",
        columns: {
          area_group_id: "",
          area_group_name: "",
        },
      },
    },
  });
};
