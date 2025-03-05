import {
  Checkbox,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { type MapProps } from ".";

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

export type VacancyLevel = "low" | "medium" | "high";
export type VacancyLevels = Record<VacancyLevel, boolean>;

interface Props {
  vacancyLevels: VacancyLevels;
  setVacancyLevels: (vacancyLevels: VacancyLevels) => void;
  unit: MapProps["view"]["unit"];
}

export function VacancyLevelCheckbox({
  vacancyLevels,
  setVacancyLevels: onChange,
  unit,
}: Props): JSX.Element {
  const styles = useStyles();

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    onChange({
      ...vacancyLevels,
      [event.target.name]: event.target.checked,
    });
  };

  const labels: Record<VacancyLevel, string> =
    unit === "building"
      ? {
          low: "0~29%",
          medium: "30~79%",
          high: "80%~",
        }
      : {
          low: "0~3%",
          medium: "4~10%",
          high: "11%~",
        };

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
