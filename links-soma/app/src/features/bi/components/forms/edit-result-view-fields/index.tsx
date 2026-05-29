import { Fragment } from "react/jsx-runtime";
import { makeStyles } from "@fluentui/react-components";
import { result_views, type SelectResultView } from "../../../../../db/schema";
import { LanguageMap } from "../../../../../shared/config/metadata";
import { useFetchDataSetResults } from "../../../../../features/dataset/hooks/use-fetch-data-set-results";
import {
  Field,
  FieldLegend,
  Fieldset,
  Input,
  Select,
} from "../../../../../shared/components/ui";
import { useEditResultViewFields } from "../../../hooks";
import { ColumnFields } from "./_column-fields";
import { YAxisMaxField } from "./_y-axis-min-max";
import { ThresholdField } from "./_threshold-field";

const useStyles = makeStyles({
  select: {
    "& > select": {
      width: "100%",
    },
  },
});

type Props = {
  dataSetResultId: SelectResultView["data_set_result_id"];
};

export const EditResultViewFields = ({
  dataSetResultId,
}: Props): JSX.Element => {
  const styles = useStyles();
  const editResultViewFieldsState = useEditResultViewFields({
    dataSetResultId,
  });
  const {
    form: { watch, register, setValue },
    handleStyleChange,
    resetParametersByStyle,
  } = editResultViewFieldsState;

  const currentParameters = watch("parameters");
  const unit = watch("unit");
  const style = watch("style");

  const { data: dataSetResults } = useFetchDataSetResults();

  if (
    currentParameters === undefined ||
    unit === undefined ||
    style === undefined
  )
    return <></>;

  return (
    <>
      <Field label="データセットを選択">
        {dataSetResults && (
          <Select {...register("dataSetResultId")} className={styles.select}>
            {dataSetResults.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title || "タイトルなし"}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="ビューのタイトル">
        <Input placeholder="選択中のビューのタイトル" {...register("title")} />
      </Field>
      <ThresholdField dataSetResultId={dataSetResultId} />
      <Fieldset>
        <FieldLegend>設定</FieldLegend>
        <Field label="種類">
          <Select {...register("style")} onChange={handleStyleChange}>
            {result_views.style.enumValues.map((item) => (
              <option key={item} value={item}>
                {LanguageMap["RESULT_VIEWS_STYLE"][item]}
              </option>
            ))}
          </Select>
        </Field>

        <ColumnFields {...editResultViewFieldsState} />

        {(style === "line" || style === "bar") && <YAxisMaxField />}

        <Field label="集計単位">
          <Select
            {...register("unit")}
            onChange={(e) => {
              // styleに合わせてparameterをリセット
              resetParametersByStyle(style);
              // スタイルの値を更新
              setValue("unit", e.target.value as "building" | "area");
            }}
          >
            {result_views.unit.enumValues.map((item) => {
              // 棒グラフの場合は集計単位を地域に固定する
              // 棒グラフの場合は集計単位を地域に固定する
              if (style === "bar") {
                if (item === "area") {
                  return (
                    <option key={item} value={item}>
                      {LanguageMap["RESULT_VIEWS_UNIT"][item]}
                    </option>
                  );
                }
                return null;
              }

              if (
                item === "area" &&
                style !== "table" &&
                style !== "map-with-table"
              ) {
                return <Fragment key={item}></Fragment>;
              }

              return (
                <option key={item} value={item}>
                  {LanguageMap["RESULT_VIEWS_UNIT"][item]}
                </option>
              );
            })}
          </Select>
        </Field>
      </Fieldset>
    </>
  );
};
