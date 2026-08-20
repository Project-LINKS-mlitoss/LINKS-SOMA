import { Fragment } from "react/jsx-runtime";
import { type SelectResultView } from "../../../../../db/schema";
import { getResultViewFieldOption } from "../../../util/get-view-field-option";
import {
  type AREA_DATASET_COLUMN,
  AREA_DATASET_COLUMN_METADATA,
  type BUILDING_DATASET_COLUMN,
  BUILDING_DATASET_COLUMN_METADATA,
} from "../../../../../shared/config/column-metadata";
import { Select } from "../../../../../shared/components/ui";
import { DynamicParameterInput } from "../dynamic-parameter-input";
import { FormGroupingResultView } from "../form-grouping-result-view";
import { type UseEditResultViewFieldsReturnType } from "../../../hooks";
import { getDefaultChartAggregation } from "../../../util/chart-aggregation";

type Props = UseEditResultViewFieldsReturnType;

/**
 * 設定すべきフィールドを一括して表示・フォームとして設定する
 * 例えば表形式や円グラフ、棒グラフごとに応じて設定すべきカラムとその値、表示名称が異なるため動的に実装する必要あり
 */
export const ColumnFields = ({
  form: { watch, register },
  fieldArray: { update, replace },
}: Props): JSX.Element => {
  const unit = watch("unit");
  const style = watch("style");
  const currentParameters = watch("parameters");

  const groupingFields = currentParameters.filter((field) => {
    return field.type === "group";
  });

  const columnFields = currentParameters.filter((field) => {
    return field.type === "column";
  });
  const groupCalc = currentParameters.find(
    (f) => f.key === "group_aggregation" && f.type === "group_aggregation",
  );

  /** 円グラフは区分けと集計を同じカラムで行うため「値」を「ラベル」に固定する */
  const isFixedToLabelColumnStyle = style === "pie";

  return (
    <>
      {columnFields.map((field, index) => {
        if (style === null || unit === null) return null;

        const fieldOption = getResultViewFieldOption(style, field.key);

        if (!fieldOption) return null;

        if (fieldOption.type === "select" && field.type === "column") {
          const column = currentParameters.find((parameter) => {
            return parameter.key === field.key && parameter.type === "column";
          });

          const columnMetadata =
            unit === "building"
              ? BUILDING_DATASET_COLUMN_METADATA[
                  column?.value as BUILDING_DATASET_COLUMN
                ]
              : AREA_DATASET_COLUMN_METADATA[
                  column?.value as AREA_DATASET_COLUMN
                ];

          /**
           * 円グラフは区分けと集計を同じカラムで行う（「値」は「ラベル」に固定）。
           * 選択させる余地がないため非活性にし、ラベルと同じカラムを表示して固定関係を示す。
           * 棒グラフ・折れ線グラフは軸ごとに別カラムを選ぶため対象外。
           */
          const isFixedToLabelColumn =
            isFixedToLabelColumnStyle && field.key === "value";
          const labelColumnValue = currentParameters.find(
            (parameter) =>
              parameter.key === "label" && parameter.type === "column",
          )?.value;

          return (
            <Fragment key={field.key}>
              <DynamicParameterInput
                type={fieldOption.type}
                {...register(`parameters.${index}.value`)}
                disabled={isFixedToLabelColumn}
                fieldOption={fieldOption}
                onChange={(e) => {
                  if (field.key === "label" || field.key === "xAxis") {
                    const parametersWithoutGroup = currentParameters.filter(
                      (f) => {
                        return f.type !== "group";
                      },
                    );
                    /**
                     * 円グラフの「値」はラベルに固定されるため、ラベルを変えたら
                     * 保存されるパラメータも追随させる。表示だけ合わせると、
                     * 保存済みビューの「値」が実際の集計対象と食い違ったまま残る。
                     */
                    replace(
                      isFixedToLabelColumnStyle && field.key === "label"
                        ? (parametersWithoutGroup.map((f) =>
                            f.key === "value" && f.type === "column"
                              ? { ...f, value: e.target.value }
                              : f,
                          ) as SelectResultView["parameters"]) // union の型推論が効きづらいため、明示的に型を指定
                        : parametersWithoutGroup,
                    );
                  }

                  update(index, {
                    key: field.key,
                    value: e.target.value,
                    type: "column",
                  } as SelectResultView["parameters"][0]); /** e.target.valueの型式別が難しいためas */
                }}
                unit={unit}
                value={
                  isFixedToLabelColumn && labelColumnValue !== undefined
                    ? labelColumnValue
                    : field.value
                }
              />
              {
                // カラムでグルーピングが設定されている場合、グルーピング設定用のフォームを表示
                fieldOption?.grouping && (
                  <FormGroupingResultView
                    columnLabel={columnMetadata?.label}
                    columnType={columnMetadata?.type}
                    onSave={(parameters) => {
                      const prevOtherParameters = currentParameters.filter(
                        (f) => {
                          return f.type !== "group";
                        },
                      );
                      const newParameters = [
                        ...prevOtherParameters,
                        ...parameters,
                      ];
                      replace(newParameters);
                    }}
                    parameters={groupingFields}
                    unit={columnMetadata?.unit}
                  />
                )
              }
              {
                /**
                 * 集計方法を選択するフォーム。X軸など集計単位の指定が不要な場合は表示しない
                 * (fieldOption.grouping === false)。
                 *
                 * 効かない状況でも欄自体は残す。消すと設定の存在に気づけないため。
                 * 円グラフ・折れ線グラフはラベルのグループがないと集計自体が起きない
                 * （1行が1つの扇形・点になる）ので、そのときだけ非活性にする。
                 * 棒グラフはグループがなくても地域名で集計するため常に効く。
                 */
                fieldOption.grouping === false && (
                  <Select
                    disabled={
                      (style === "pie" || style === "line") &&
                      groupingFields.length === 0
                    }
                    onChange={(e) => {
                      const prevOtherParameters = currentParameters.filter(
                        (f) => {
                          return f.type !== "group_aggregation";
                        },
                      );
                      const newParameters = [
                        ...prevOtherParameters,
                        {
                          key: "group_aggregation",
                          value: e.target.value as "avg" | "sum" | "count",
                          type: "group_aggregation",
                        },
                      ] as SelectResultView["parameters"]; // union の型推論が効きづらいため、明示的に型を指定;
                      replace(newParameters);
                    }}
                    /**
                     * 未設定のビューでも取得側と同じ既定を表示する。
                     * 値を渡さないと、ブラウザが非活性でない先頭の選択肢（値の合計）を
                     * 選んだように見せてしまい、実際の集計と食い違う。
                     */
                    value={
                      groupCalc?.value ?? getDefaultChartAggregation(style)
                    }
                  >
                    {/**
                     * 円グラフは全体の内訳を表す図であり、扇形を足し合わせて全体になる集計しか
                     * 成立しない。平均は足し合わせても全体にならないため選べないようにする。
                     * 既存ビューが平均で保存されている場合に選択が空欄化しないよう、
                     * 選択肢自体は残して非活性にする。
                     */}
                    <option disabled={style === "pie"} value="avg">
                      値の平均
                    </option>
                    <option value="sum">値の合計</option>
                    <option value="count">総件数（世帯数）</option>
                  </Select>
                )
              }
            </Fragment>
          );
        }

        // dropdownの場合は、DynamicParameterInputを使って表示するがonChangeの挙動が異なるため別記述
        if (fieldOption.type === "dropdown") {
          return (
            <DynamicParameterInput
              type={fieldOption.type}
              {...register(`parameters.${index}.value`)}
              key={field.key}
              fieldOption={fieldOption}
              multiple={fieldOption.multiple ?? false}
              onChange={(_, data) => {
                // dropdownから返ってくる値が空の場合は何もしない
                if (data.optionValue === undefined) return;

                // 更新前の値をカンマ区切りの文字列としてデータクレンジングした上で配列化
                const prevValue = field.value
                  .split(",")
                  .filter((value) => value !== "");

                // 更新後の値を生成
                const newValue = prevValue.includes(data.optionValue)
                  ? prevValue.filter((value) => {
                      return value !== data.optionValue;
                    })
                  : [...prevValue, data.optionValue];

                update(index, {
                  key: field.key,
                  value: newValue.join(","),
                  type: "column",
                } as SelectResultView["parameters"][0]); /** e.target.valueの型式別が難しいためas */
              }}
              unit={unit}
              value={field.value}
            />
          );
        }

        // dialogの場合は、DynamicParameterInputを使って表示するがonSaveの挙動が異なるため別記述
        if (fieldOption.type === "dialog") {
          return (
            <DynamicParameterInput
              type="dialog"
              {...register(`parameters.${index}.value`)}
              key={field.key}
              fieldOption={fieldOption}
              multiple={fieldOption.multiple ?? false}
              onSave={(newValue) => {
                update(index, {
                  key: field.key,
                  value: newValue.join(","),
                  type: "column",
                } as SelectResultView["parameters"][0]); /** e.target.valueの型式別が難しいためas */
              }}
              unit={unit}
              value={field.value}
            />
          );
        }

        return <></>;
      })}
    </>
  );
};
