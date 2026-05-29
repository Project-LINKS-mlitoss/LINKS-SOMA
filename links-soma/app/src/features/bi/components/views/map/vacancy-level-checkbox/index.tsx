import {
  Checkbox,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { type VacancyLevel } from "./types";
import { type UseVacancyLevelCheckboxReturn } from "./hooks";

const useStyles = makeStyles({
  container: {
    display: "flex",
    alignItems: "center",
    borderRadius: "6px",
    userSelect: "none",
    gap: tokens.spacingHorizontalS,
  },
  label: {
    display: "flex",
    alignItems: "center",
    paddingRight: "8px",
    borderRadius: "4px",
    cursor: "pointer",
  },
  checkbox: {
    width: "20px",
    height: "20px",
    marginRight: "8px",
    cursor: "pointer",
  },
  text: {
    color: "#374151",
  },
  low: {
    backgroundColor: tokens.colorPaletteGreenBackground1,
  },
  medium: {
    backgroundColor: tokens.colorPaletteYellowBackground1,
  },
  high: {
    backgroundColor: tokens.colorPaletteRedBackground1,
  },
});

type Props = UseVacancyLevelCheckboxReturn;

export function VacancyLevelCheckbox({
  vacancyLevels,
  handleChange,
  labels,
}: Props): JSX.Element {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      {Object.entries(vacancyLevels).map(([key, value]) => (
        <label
          key={key}
          className={mergeClasses(
            styles.label,
            styles[key as keyof typeof styles],
          )}
        >
          <Checkbox checked={value} name={key} onChange={handleChange} />
          <span className={styles.text}>{labels[key as VacancyLevel]}</span>
        </label>
      ))}
    </div>
  );
}
