import {
  makeStyles,
  mergeClasses,
  Tooltip as FUITooltip,
  tokens,
} from "@fluentui/react-components";
import { type TooltipProps } from "recharts";
import {
  type NameType,
  type ValueType,
} from "recharts/types/component/DefaultTooltipContent";

const useStyles = makeStyles({
  tooltipContainer: {
    transform: "translate(-50%, -100%)",
  },
  dummyDiv: {
    width: "1px",
    height: "1px",
  },
  tooltip: {
    backgroundColor: tokens.colorNeutralForeground2,
    color: tokens.colorNeutralForegroundInverted,
    fontSize: tokens.fontSizeBase200,
    padding: `5px ${tokens.spacingHorizontalM}`, //tokensに存在しない値
    boxShadow: tokens.shadow8,
    borderRadius: "3px", // tokensに存在しない値
  },
});

/**
 * TooltipPropsに渡す２つの型は、ベースのTooltipPropsが必要とする型で最低限のものを渡している
 */
type CustomTooltipProps = TooltipProps<ValueType, NameType>;

export const CustomTooltip = ({
  active,
  payload,
}: CustomTooltipProps): JSX.Element | null => {
  const styles = useStyles();

  if (active && payload && payload.length) {
    const label = payload[0].value ?? "";
    const unit = payload[0].unit ?? "";

    return (
      <div className={mergeClasses(styles.tooltipContainer)}>
        <FUITooltip
          content={{
            children: (
              <>
                {label}
                {unit}
              </>
            ),
            className: styles.tooltip,
          }}
          relationship="label"
          visible={true}
          withArrow={true}
        >
          {/* FUIのToolTipは<div>を起点に表示されるため、1px x 1px 分だけ作成 */}
          <div className={styles.dummyDiv}></div>
        </FUITooltip>
      </div>
    );
  }

  return null;
};
