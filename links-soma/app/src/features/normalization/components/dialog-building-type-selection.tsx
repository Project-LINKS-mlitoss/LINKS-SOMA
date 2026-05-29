import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Checkbox,
  Dialog,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { FixedSizeList as List } from "react-window";
import { lang } from "../../../shared/config/lang";
import {
  Button,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Input,
  TextWithTooltip,
} from "../../../shared/components/ui";

const useStyles = makeStyles({
  triggerContainer: {
    display: "flex",
    gap: "8px",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  triggerText: {
    fontSize: "12px",
    lineHeight: "32px",
    color: tokens.colorNeutralForeground1,
  },
  triggerTextEmpty: {
    color: tokens.colorNeutralForeground3,
  },
  editButton: {
    minWidth: "50px",
    fontSize: "12px",
  },
  dialogTitle: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
  },
  searchInput: {
    minWidth: "200px",
  },
  listHeader: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  listHeaderText: {
    fontSize: "12px",
    color: tokens.colorNeutralForeground3,
  },
  listHeaderSeparator: {
    color: tokens.colorNeutralStroke2,
    marginLeft: "auto",
  },
  listHeaderAction: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    fontSize: "12px",
    color: tokens.colorNeutralForeground2,
  },
  listHeaderButtons: {
    display: "flex",
    gap: tokens.spacingHorizontalXS,
  },
  addAllButton: {
    fontSize: "12px",
    minWidth: "auto",
    padding: `0 ${tokens.spacingHorizontalS}`,
  },
  listContainer: {
    height: "280px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  listItem: {
    display: "flex",
    alignItems: "center",
    padding: `0 ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    cursor: "pointer",
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  footer: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
  },
  selectedCount: {
    fontSize: "12px",
    color: tokens.colorNeutralForeground3,
  },
  selectedTagsContainer: {
    maxHeight: "90px",
    overflowY: "auto",
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalXS,
    padding: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  selectedTag: {
    fontSize: "11px",
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
    backgroundColor: tokens.colorNeutralBackground4,
    borderRadius: tokens.borderRadiusSmall,
    color: tokens.colorNeutralForeground2,
    whiteSpace: "nowrap",
  },
  selectedTagEmpty: {
    fontSize: "12px",
    color: tokens.colorNeutralForeground3,
    fontStyle: "italic",
  },
  emptyMessage: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    color: tokens.colorNeutralForeground3,
    fontSize: "14px",
  },
});

const ITEM_HEIGHT = 32;
const LIST_HEIGHT = 280;

type Props = {
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
};

/**
 * 家屋種別選択ダイアログ
 * 大量のオプション（最大900件程度）から複数選択するためのUI
 */
export const DialogBuildingTypeSelection = ({
  options,
  selectedValues,
  onChange,
  disabled = false,
}: Props): JSX.Element => {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [localSelected, setLocalSelected] = useState<string[]>(selectedValues);
  const [searchText, setSearchText] = useState("");
  const deferredSearchText = useDeferredValue(searchText);

  // ダイアログが開いたときに選択状態を同期
  useEffect(() => {
    if (open) {
      setLocalSelected(selectedValues);
      setSearchText("");
    }
  }, [open, selectedValues]);

  // 検索フィルタリング（全角スペースも除去）
  const filteredOptions = useMemo(
    () =>
      options.filter((option) =>
        option.includes(deferredSearchText.trim().replace(/\u3000/g, "")),
      ),
    [options, deferredSearchText],
  );

  const handleToggle = useCallback((value: string, checked: boolean) => {
    setLocalSelected((prev) => {
      if (checked) {
        return prev.includes(value) ? prev : [...prev, value].sort();
      } else {
        return prev.filter((v) => v !== value);
      }
    });
  }, []);

  const handleAddAll = useCallback(() => {
    setLocalSelected((prev) => {
      const newValues = new Set(prev);
      filteredOptions.forEach((option) => newValues.add(option));
      return Array.from(newValues).sort();
    });
  }, [filteredOptions]);

  // 検索結果に含まれるアイテムを選択から外す
  const handleRemoveFiltered = useCallback(() => {
    setLocalSelected((prev) => {
      const filteredSet = new Set(filteredOptions);
      return prev.filter((v) => !filteredSet.has(v));
    });
  }, [filteredOptions]);

  const handleClearAll = useCallback(() => {
    setLocalSelected([]);
  }, []);

  const handleSave = useCallback(() => {
    onChange(localSelected);
    setOpen(false);
  }, [localSelected, onChange]);

  // 閉じた状態の表示テキスト
  const displayText =
    selectedValues.length === 0
      ? null
      : `${selectedValues.length}件選択中（${selectedValues.slice(0, 3).join(", ")}${selectedValues.length > 3 ? "..." : ""}）`;

  return (
    <>
      <div className={styles.triggerContainer}>
        <span
          className={`${styles.triggerText} ${selectedValues.length === 0 ? styles.triggerTextEmpty : ""}`}
        >
          {displayText ?? "家屋種別を選択してください"}
        </span>
        <Button
          className={styles.editButton}
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          変更
        </Button>
      </div>

      <Dialog onOpenChange={(_, data) => setOpen(data.open)} open={open}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle className={styles.dialogTitle}>
              <TextWithTooltip
                textNode={
                  lang.components.normalizationParameters.building_type_values
                    .label
                }
                tooltipContent={
                  lang.components.normalizationParameters.building_type_values
                    .description
                }
              />
              <Input
                className={styles.searchInput}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="検索..."
                value={searchText}
              />
            </DialogTitle>

            <DialogContent padding={false}>
              {/* リストヘッダー */}
              <div className={styles.listHeader}>
                <span className={styles.listHeaderText}>
                  {filteredOptions.length}件表示
                </span>
                <span className={styles.listHeaderSeparator}>｜</span>
                <div className={styles.listHeaderAction}>
                  <span>表示中の項目をすべて</span>
                  <div className={styles.listHeaderButtons}>
                    <Button
                      appearance="subtle"
                      className={styles.addAllButton}
                      disabled={filteredOptions.length === 0}
                      onClick={handleAddAll}
                    >
                      追加
                    </Button>
                    <Button
                      appearance="subtle"
                      className={styles.addAllButton}
                      disabled={filteredOptions.length === 0}
                      onClick={handleRemoveFiltered}
                    >
                      削除
                    </Button>
                  </div>
                </div>
              </div>

              {/* 仮想スクロールリスト */}
              <div className={styles.listContainer}>
                {filteredOptions.length === 0 ? (
                  <div className={styles.emptyMessage}>
                    {options.length === 0
                      ? "選択肢がありません"
                      : "検索結果がありません"}
                  </div>
                ) : (
                  <VirtualizedList
                    filteredOptions={filteredOptions}
                    localSelected={localSelected}
                    onToggle={handleToggle}
                  />
                )}
              </div>

              {/* フッター */}
              <div className={styles.footer}>
                <span className={styles.selectedCount}>
                  選択中: {localSelected.length}件
                </span>
                <div className={styles.selectedTagsContainer}>
                  {localSelected.length === 0 ? (
                    <span className={styles.selectedTagEmpty}>
                      項目を選択してください
                    </span>
                  ) : (
                    localSelected.map((item) => (
                      <span key={item} className={styles.selectedTag}>
                        {item}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </DialogContent>

            <DialogActions>
              <Button
                appearance="outline"
                disabled={localSelected.length === 0}
                onClick={handleClearAll}
              >
                すべて解除
              </Button>
              <Button appearance="primary" onClick={handleSave}>
                保存
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
};

// 仮想スクロールリストを分離してメモ化
type VirtualizedListProps = {
  filteredOptions: string[];
  localSelected: string[];
  onToggle: (value: string, checked: boolean) => void;
};

const VirtualizedList = memo(
  ({ filteredOptions, localSelected, onToggle }: VirtualizedListProps) => {
    const styles = useStyles();

    const Row = useCallback(
      ({ index, style }: { index: number; style: React.CSSProperties }) => {
        const option = filteredOptions[index];
        const isChecked = localSelected.includes(option);

        return (
          <div
            className={styles.listItem}
            onClick={() => onToggle(option, !isChecked)}
            style={style}
          >
            <Checkbox
              checked={isChecked}
              label={option}
              onChange={(_, data) => {
                onToggle(option, data.checked === true);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        );
      },
      [filteredOptions, localSelected, onToggle, styles.listItem],
    );

    return (
      <List
        height={LIST_HEIGHT}
        itemCount={filteredOptions.length}
        itemSize={ITEM_HEIGHT}
        width="100%"
      >
        {Row}
      </List>
    );
  },
);

VirtualizedList.displayName = "VirtualizedList";
