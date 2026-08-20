import { Field, makeStyles, tokens } from "@fluentui/react-components";
import { ErrorCircle12Filled } from "@fluentui/react-icons";
import { type ReactNode } from "react";
import { THEME_COLORS } from "../config/theme-colors";

const useStyles = makeStyles({
  // 検証メッセージはアプリ標準のエラー赤 (THEME_COLORS.error) に統一する。
  // Field の token 既定色をスロット側の明示色で上書き（子要素の明示色が継承色に勝つ）。
  errorText: { color: THEME_COLORS.error },
  errorIcon: { color: THEME_COLORS.error },
  // Field 既定の余白(XXS)はコントロール直下で詰まるため、ボタンとの間隔を広げる。
  message: { marginTop: tokens.spacingVerticalS },
});

/**
 * 必須選択の検証表示。Fluent Field の構造（コントロール直下にアイコン＋メッセージ）に、
 * アプリ標準のエラー赤を適用する。error が無ければメッセージは描画されない。
 * 推定・モデル構築など「必須選択を zod で止める」画面で共通利用する。
 */
export const RequiredField = ({
  error,
  children,
}: {
  error?: { message?: string };
  children: ReactNode;
}): JSX.Element => {
  const styles = useStyles();
  return (
    <Field
      validationMessage={
        error
          ? {
              children: (
                <span className={styles.errorText}>{error.message}</span>
              ),
              className: styles.message,
            }
          : undefined
      }
      validationMessageIcon={
        error ? <ErrorCircle12Filled className={styles.errorIcon} /> : undefined
      }
      validationState={error ? "error" : "none"}
    >
      {children}
    </Field>
  );
};
