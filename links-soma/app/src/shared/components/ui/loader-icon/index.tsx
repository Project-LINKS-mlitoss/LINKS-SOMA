import styles from "./styles.module.css";

export const LoaderIcon = ({
  style,
}: {
  style?: React.CSSProperties;
}): JSX.Element => <div className={styles.loader} style={style}></div>;
