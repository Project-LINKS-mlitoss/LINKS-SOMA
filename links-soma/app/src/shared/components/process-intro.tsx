/**
 * 処理画面の冒頭に置く「この処理は何か・何をするか」の説明。
 *
 * 名寄せ / モデル構築 / 空き家推定 の各 create 画面で、見出し直下に表示する。
 * ガイド起動ダイアログの全体フロー説明（一言サマリー）とは粒度を分け、
 * ここでは当該工程の目的と入出力を 1〜2 文で説明する（段階的開示）。
 * 装飾の箱は持たず、見出しに従属する控えめな helper text として置く（認知負荷を下げる）。
 */

import { makeStyles, tokens, Caption1 } from "@fluentui/react-components";

const useStyles = makeStyles({
  text: {
    display: "block",
    color: tokens.colorNeutralForeground3,
    // 行間に余裕を持たせる。上下の余白は配置側コンテナ（flex gap）が持つ（二重余白の回避）。
    lineHeight: tokens.lineHeightBase300,
    // 1 行が長くなりすぎないよう可読幅で折り返す。
    maxWidth: "880px",
  },
});

export const ProcessIntro = ({
  description,
}: {
  description: string;
}): JSX.Element => {
  const styles = useStyles();
  return <Caption1 className={styles.text}>{description}</Caption1>;
};
