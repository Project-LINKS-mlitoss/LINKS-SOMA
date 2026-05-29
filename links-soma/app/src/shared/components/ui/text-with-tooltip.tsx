import {
  makeStyles,
  tokens,
  Tooltip,
  type TooltipProps,
} from "@fluentui/react-components";
import { InfoFilled } from "@fluentui/react-icons";
import { type ReactNode } from "react";

const useStyles = makeStyles({
  root: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  icon: {
    fontSize: tokens.fontSizeBase500,
    color: tokens.colorBrandBackground,
  },
  content: {
    whiteSpace: "pre-line",
  },
});

type Props = {
  textNode: string | ReactNode;
  tooltipContent: string | ReactNode;
  tooltipProps?: TooltipProps;
};

export const TextWithTooltip = ({
  textNode,
  tooltipContent,
}: Props): JSX.Element => {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      {textNode}
      {tooltipContent && (
        <Tooltip
          content={<div className={styles.content}>{tooltipContent}</div>}
          relationship="description"
          withArrow
        >
          <InfoFilled className={styles.icon} />
        </Tooltip>
      )}
    </div>
  );
};
