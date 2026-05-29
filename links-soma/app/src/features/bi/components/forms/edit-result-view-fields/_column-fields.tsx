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

          return (
            <Fragment key={field.key}>
              <DynamicParameterInput
                type={fieldOption.type}
                {...register(`parameters.${index}.value`)}
                fieldOption={fieldOption}
                onChange={(e) => {
                  if (field.key === "label" || field.key === "xAxis") {
                    const parametersWithoutGroup = currentParameters.filter(
                      (f) => {
                        return f.type !== "group";
                      },
                    );
                    replace(parametersWithoutGroup);
                  }

                  update(index, {
                    key: field.key,
                    value: e.target.value,
                    type: "column",
                  } as SelectResultView["parameters"][0]); /** e.target.valueの型式別が難しいためas */
                }}
                unit={unit}
                value={field.value}
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
                 * グルーピングが設定されている場合、集計単位を選択するフォームを表示
                 * ただし、X軸など集計単位の指定が不要な場合は表示しない(fieldOption.grouping === false)
                 * また、グルーピングが設定されていない場合も表示しない(groupingFields.length > 0)
                 */
                fieldOption.grouping === false && groupingFields.length > 0 && (
                  <Select
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
                    value={groupCalc?.value}
                  >
                    <option value="avg">値の平均</option>
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
