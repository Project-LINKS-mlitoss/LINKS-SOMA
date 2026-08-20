import { makeStyles } from "@fluentui/react-components";
import {
  ChevronUp16Regular,
  ChevronDown16Regular,
} from "@fluentui/react-icons";
import { Button } from "../../../../../shared/components/ui";
import { lang } from "../../../../../shared/config/lang";

const useStyles = makeStyles({
  container: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  },
});

type Props = {
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

/**
 * ラベルのグループ1件分の並べ替え操作。
 *
 * 並び順がそのまま優先順位（上にあるほど先に判定される）を表すため、順位を数字で重ねて
 * 示さず、移動ボタンのみを置く。先頭・末尾のボタンを非活性にすることで位置が読める。
 *
 * 並べ替えはドラッグではなくボタンで行う。WCAG 2.2 の達成基準 2.5.7（ドラッグ動作）が
 * ドラッグ以外の単一ポインタ操作での代替を求めており、その代替手段として上下ボタンが
 * 例示されているため、ボタンのみで要件を満たせる。
 */
export const PriorityControl = ({
  index,
  total,
  onMoveUp,
  onMoveDown,
}: Props): JSX.Element => {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      <Button
        appearance="subtle"
        aria-label={lang.components.resultView.labelGroupMoveUp}
        disabled={index === 0}
        icon={<ChevronUp16Regular />}
        onClick={onMoveUp}
        type="button"
      />
      <Button
        appearance="subtle"
        aria-label={lang.components.resultView.labelGroupMoveDown}
        disabled={index === total - 1}
        icon={<ChevronDown16Regular />}
        onClick={onMoveDown}
        type="button"
      />
    </div>
  );
};
