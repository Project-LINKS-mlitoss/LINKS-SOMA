/**
 * 修正方法（fix guide）の表示（FR006 / #1786）。
 *
 * マニュアル相当の直し方（何が悪い・正しい形式・修正前→修正後）をアプリ内に内蔵し、
 * エラー時に段階開示（Progressive Disclosure）で示す。既定は折りたたみ、見出し行の
 * クリックで詳細を開く。重い枠線ボックスでなく軽量なシェブロン行（住所表記ゆれ結果と
 * 同じ開閉パターン）を使う。修正前→修正後は色に依存せず、太字で「直した後」を示す
 * （色だけに依存しない情報伝達・design-principles）。
 */

import { useState } from "react";
import {
  Caption1,
  Caption1Strong,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  ChevronDown16Regular,
  ChevronRight16Regular,
} from "@fluentui/react-icons";
import { lang } from "../../../shared/config/lang";
import type { FixGuide } from "../../../shared/types/job-task-result";

const t = lang.components.errorDisplay;

const useStyles = makeStyles({
  toggle: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    cursor: "pointer",
    width: "fit-content",
    padding: `${tokens.spacingVerticalXXS} 0`,
    background: "none",
    border: "none",
    color: "inherit",
    font: "inherit",
    textAlign: "left",
  },
  body: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalXS,
    paddingTop: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalL,
  },
  list: {
    margin: 0,
    paddingLeft: tokens.spacingHorizontalL,
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalXXS,
  },
  example: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalXS,
    flexWrap: "wrap",
  },
});

export const FixGuideView = ({ guide }: { guide: FixGuide }): JSX.Element => {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        aria-expanded={open}
        className={styles.toggle}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        {open ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
        <Caption1>{open ? t.fixGuideClose : t.fixGuideToggle}</Caption1>
      </button>
      {open && (
        <div className={styles.body}>
          <Caption1Strong>{guide.what}</Caption1Strong>
          {guide.accepted && guide.accepted.length > 0 && (
            <>
              <Caption1>{t.acceptedLabel}</Caption1>
              <ul className={styles.list}>
                {guide.accepted.map((line) => (
                  <li key={line}>
                    <Caption1>{line}</Caption1>
                  </li>
                ))}
              </ul>
            </>
          )}
          {guide.examples && guide.examples.length > 0 && (
            <>
              <Caption1>{t.exampleLabel}</Caption1>
              {guide.examples.map((ex) => (
                <div key={ex.before} className={styles.example}>
                  <Caption1>{ex.before}</Caption1>
                  <Caption1>→</Caption1>
                  <Caption1Strong>{ex.after}</Caption1Strong>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};
