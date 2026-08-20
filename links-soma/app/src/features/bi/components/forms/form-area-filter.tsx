import {
  Fragment,
  lazy,
  Suspense,
  useDeferredValue,
  useEffect,
  useState,
} from "react";
import {
  Dialog,
  DialogTrigger,
  makeStyles,
  Spinner,
} from "@fluentui/react-components";
import { type FetchAreaGroupsArg } from "../../ipc/select-area-groups";
import {
  Field,
  Button,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Input,
} from "../../../../shared/components/ui";
import { useFetchAreaGroups } from "../../hooks/use-fetch-area-groups";

const useStyles = makeStyles({
  selectedOptions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px 8px",
    fontSize: "12px",
  },
  layout: {
    display: "flex",
    gap: "4px",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  editButton: {
    minWidth: "50px",
    fontSize: "12px",
  },
  noSelectedLabel: {
    lineHeight: "32px",
    fontSize: "12px",
  },
  emptyState: {
    minHeight: "120px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    fontSize: "12px",
    padding: "0 16px",
  },
});

// コンポーネントを遅延評価で読み込むことでパフォーマンスに配慮
// 元は１つ上の親コンポーネントで読み込んでいたが、Dialogを開いた際に読み込まれるように変更
const AreaFilterFormOptions = lazy(() =>
  import("./form-area-filter-options").then((module) => ({
    default: module.FormAreaFilterOptions,
  })),
);

type UseHandleClick = {
  areas: string[];
  onSave: (value: string[]) => void;
  areaGroups: string[] | undefined;
};

/** 地域選択の振る舞いに関する機能を集約 */
const useHandleAreas = ({
  areas,
  onSave,
  areaGroups,
}: UseHandleClick): {
  handleClick: () => void;
  handleAllClear: () => void;
  handleAllCheck: () => void;
  isAllCleared: boolean;
  setSelectedAreas: (value: string[]) => void;
  selectedAreas: string[];
  searchFilteredData: string[] | undefined;
  handleSearchText: (e: React.ChangeEvent<HTMLInputElement>) => void;
  searchText: string;
} => {
  const [selectedAreas, setSelectedAreas] = useState<string[]>(areas);
  const isAllCleared = selectedAreas.length === 0;

  const handleClick = (): void => {
    onSave(selectedAreas);
  };
  const handleAllClear = (): void => {
    setSelectedAreas([]);
  };
  const handleAllCheck = (): void => {
    if (!searchFilteredData) return;
    setSelectedAreas(searchFilteredData);
  };

  const [searchText, setSearchText] = useState("");
  // 検索テキストの逐次変更でなく、再計算が終わるまで遅延させることで画面のチラつき・カクツキを減らす
  // reference: https://ja.react.dev/reference/react/useDeferredValue#deferring-re-rendering-for-a-part-of-the-ui
  const deferredSearchText = useDeferredValue(searchText);
  const searchFilteredData = areaGroups?.filter(
    (area) => area.includes(deferredSearchText.trim().replace("　", "")), // 余計な空白や文字列の削除
  );

  const handleSearchText = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchText(e.target.value);
  };

  // 選択した値を更新する。特に集計単位の変更時にダイアログの値をリセットするため。
  // 依存は値(areasKey)で比較する。identity で見ると、地域未選択時の `?? []` が
  // 親の再レンダーごとに新しい配列になり、選択途中のチェックを巻き戻してしまう
  const areasKey = JSON.stringify(areas);
  useEffect(
    function updateAreas() {
      setSelectedAreas(areas);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- areas は areasKey で値比較する
    [areasKey],
  );

  return {
    handleClick,
    handleAllClear,
    handleAllCheck,
    isAllCleared,
    setSelectedAreas,
    selectedAreas,
    searchFilteredData,
    handleSearchText,
    searchText,
  };
};

type Props = {
  areas: string[];
  onSave: (value: string[]) => void;
} & FetchAreaGroupsArg;

/**
 * 地域フィルタ用のフィールド表示コンポーネント
 */
export const FormAreaFilter = (props: Props): JSX.Element => {
  const [open, setOpen] = useState(false);

  const { data } = useFetchAreaGroups({
    dataSetResultId: props.dataSetResultId,
    unit: props.unit,
  });

  const {
    handleClick,
    handleAllClear,
    handleAllCheck,
    isAllCleared,
    setSelectedAreas,
    selectedAreas,
    searchFilteredData,
    searchText,
    handleSearchText,
  } = useHandleAreas({
    areas: props.areas,
    onSave: props.onSave,
    areaGroups: data,
  });

  const styles = useStyles();

  // 取得完了かつ地域候補ゼロ（推定時に地域集計用データ未設定など）
  const hasNoAreaData = data !== undefined && data.length === 0;

  return (
    <Field label="地域">
      <div className={styles.layout}>
        <div>
          {props.areas.length === 0 ? (
            <p className={styles.noSelectedLabel}>地域を選択してください</p>
          ) : (
            <div className={styles.selectedOptions}>
              {props.areas.map((area, index) => (
                <Fragment key={area}>
                  {index !== 0 && <span>/</span>}
                  <span key={area}>{area}</span>
                </Fragment>
              ))}
            </div>
          )}
        </div>
        <div>
          <Button
            className={styles.editButton}
            onClick={() => {
              setOpen(true);
            }}
          >
            変更
          </Button>
        </div>
      </div>
      <Dialog
        onOpenChange={() => {
          setOpen((prev) => !prev);
        }}
        open={open}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle
              action={
                <Input
                  onChange={handleSearchText}
                  placeholder="地域を検索"
                  value={searchText}
                />
              }
            >
              地域を選択
            </DialogTitle>
            <DialogContent border>
              {hasNoAreaData ? (
                // 空のチェックボックス群でなく理由を示す
                <p className={styles.emptyState}>
                  地域データがありません。推定時に地域集計用データを設定すると、地域で絞り込めます。
                </p>
              ) : (
                <Suspense fallback={<Spinner />}>
                  <AreaFilterFormOptions
                    dataSetResultId={props.dataSetResultId}
                    onChange={setSelectedAreas}
                    searchFilteredData={searchFilteredData}
                    selectedAreas={selectedAreas}
                    unit={props.unit}
                  />
                </Suspense>
              )}
            </DialogContent>
            <DialogActions>
              {!hasNoAreaData && isAllCleared && (
                <Button
                  appearance="outline"
                  disabled={data === undefined}
                  onClick={handleAllCheck}
                >
                  すべて選択
                </Button>
              )}
              {!hasNoAreaData && !isAllCleared && (
                <Button appearance="outline" onClick={handleAllClear}>
                  すべてクリア
                </Button>
              )}
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="primary" onClick={handleClick}>
                  保存
                </Button>
              </DialogTrigger>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </Field>
  );
};
