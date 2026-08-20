import { Tooltip, makeStyles, tokens } from "@fluentui/react-components";
import { ArrowResetRegular } from "@fluentui/react-icons";
import { Range, getTrackBackground } from "react-range";
import { Button } from "../../../../../../shared/components/ui";
import { type UseProbabilityRangeReturn } from "./hooks";

const TRACK_HEIGHT = 10;
/** Fluent Switch のノブ径（trackHeight 20 − spaceBetweenThumbAndTrack 2）に一致 */
const THUMB_SIZE = 18;
/** 範囲外（対象外）の淡色。トグルの OFF と同様に「効いていない」ことを示す */
const OFF_COLOR = "#d4d4d4";

const useStyles = makeStyles({
  // スライダーとリセットを横並びにし、隣の推定日・表と高さを揃える。
  // flex-start + リセット側の固定高で、アイコンをバー（トラック）の中央に合わせる
  container: {
    display: "flex",
    alignItems: "flex-start",
    gap: tokens.spacingHorizontalXS,
    minWidth: "288px",
  },
  sliderCol: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: tokens.spacingVerticalXXS,
    flexGrow: 1,
    // つまみが左右端で見切れないよう、半径＋バッファぶんの横余白を確保
    padding: `0 ${THUMB_SIZE / 2 + 4}px`,
  },
  // つまみ（トラックより高い）を上下に切らずに収め、トラックを縦中央に置く
  sliderRow: {
    display: "flex",
    alignItems: "center",
    height: `${THUMB_SIZE}px`,
  },
  thumb: {
    height: `${THUMB_SIZE}px`,
    width: `${THUMB_SIZE}px`,
    borderRadius: "50%",
    backgroundColor: tokens.colorNeutralBackground1,
    border: `2px solid ${tokens.colorNeutralStroke1}`,
    boxShadow: tokens.shadow8,
    cursor: "pointer",
  },
  labels: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  // 幅を常に確保し、リセット表示/非表示でトラック幅が変わらないようにする。
  // 高さをトラック行に合わせ、アイコンをバー中央に縦整列させる
  resetSlot: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    width: "24px",
    height: `${THUMB_SIZE}px`,
  },
});

const toPercent = (value: number): string =>
  `${Math.round(value * 1000) / 10}%`;

export function ProbabilityRangeSlider({
  range,
  setRange,
  domainMin,
  domainMax,
}: UseProbabilityRangeReturn): JSX.Element {
  const styles = useStyles();

  // 全域＝絞り込みなし。戻す対象がないのでリセットは出さない
  const isFullRange = range[0] === domainMin && range[1] === domainMax;

  // 範囲内をアクセント色、範囲外をグレーでハイライト（標準的なレンジスライダー）
  const trackBackground = getTrackBackground({
    values: range,
    colors: [OFF_COLOR, tokens.colorBrandBackground, OFF_COLOR],
    min: domainMin,
    max: domainMax,
  });

  return (
    <div className={styles.container}>
      <div className={styles.sliderCol}>
        <div className={styles.sliderRow}>
          <Range
            max={domainMax}
            min={domainMin}
            onChange={(values) => setRange([values[0], values[1]])}
            renderThumb={({ props }) => (
              <div
                {...props}
                className={styles.thumb}
                style={{ ...props.style }}
              />
            )}
            renderTrack={({ props, children }) => (
              <div
                {...props}
                style={{
                  ...props.style,
                  height: `${TRACK_HEIGHT}px`,
                  width: "100%",
                  borderRadius: `${TRACK_HEIGHT / 2}px`,
                  background: trackBackground,
                }}
              >
                {children}
              </div>
            )}
            step={(domainMax - domainMin) / 100}
            values={range}
          />
        </div>
        <div className={styles.labels}>
          <span>{toPercent(range[0])}</span>
          <span>{toPercent(range[1])}</span>
        </div>
      </div>
      <div className={styles.resetSlot}>
        {!isFullRange && (
          <Tooltip content="リセット" relationship="label">
            <Button
              appearance="subtle"
              icon={<ArrowResetRegular />}
              onClick={() => setRange([domainMin, domainMax])}
            />
          </Tooltip>
        )}
      </div>
    </div>
  );
}
