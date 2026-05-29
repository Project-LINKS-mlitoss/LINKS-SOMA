import { generateAllColumnsData } from "../../../../../util";
import styles from "./popup-shared.module.css";

interface AllColumnsViewProps<T extends Record<string, unknown>> {
  properties: T;
  type: "area" | "building";
  className?: string;
}

export const AllColumnsView = <T extends Record<string, unknown>>({
  properties,
  type,
  className,
}: AllColumnsViewProps<T>): JSX.Element => {
  const allColumnsData = generateAllColumnsData(properties, type);

  return (
    <div className={className}>
      {allColumnsData.map((item) => (
        <div key={item.key} className={styles.item}>
          <span className={styles.itemLabel}>{item.label}</span>
          <span className={styles.itemValue}>
            {item.value || <span style={{ color: "#999" }}>--</span>}
          </span>
        </div>
      ))}
    </div>
  );
};
