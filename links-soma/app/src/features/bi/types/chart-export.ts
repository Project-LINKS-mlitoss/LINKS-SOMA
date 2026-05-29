/**
 * チャートビューのエクスポート機能を外部から制御するためのハンドル型
 * useImperativeHandleで公開され、親コンポーネントからrefを通じてアクセスされる
 */
export type ChartExportHandle = {
  /** チャートデータをCSVとしてエクスポートする */
  exportCsv: () => Promise<void>;
};
