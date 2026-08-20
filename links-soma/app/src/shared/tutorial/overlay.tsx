/**
 * チュートリアル動線の全画面共通オーバーレイ。
 *
 * 起動 / 再開確認 / 終了確認 / 完了 の各ダイアログと、進行中ガイド (右上トグル) を束ねる。
 * サイドバーから描画され、両レイアウト (通常 / パディングなし) に常駐する。
 * design.pen「検討: フロー-*ダイアログ」準拠 (文言は暫定。用語は「ガイド」)。
 */

import { useState } from "react";
import {
  Dialog,
  Radio,
  RadioGroup,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useNavigate } from "react-router-dom";
import {
  Button,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
} from "../components/ui";
import { lang } from "../config/lang";
import { ROUTES } from "../config/routes";
import { TutorialGuide } from "./progress-popover";
import { TUTORIAL_STAGES } from "./stages";
import { tutorialStore, useTutorial, type ModelMode } from "./store";
import { useResumeNavigate } from "./use-resume-navigate";

const t = lang.components.tutorial;

const useStyles = makeStyles({
  section: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalL,
  },
  heading: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  flow: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalXS,
    margin: 0,
    paddingLeft: tokens.spacingHorizontalL,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase200,
  },
  radioLabel: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalXXS,
  },
  radioDesc: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
});

export const TutorialOverlay = (): JSX.Element => {
  const styles = useStyles();
  const { launchOpen, resumeOpen, endConfirmOpen, completeOpen, stage } =
    useTutorial();
  const navigate = useNavigate();
  const goToResume = useResumeNavigate();
  // 起動ダイアログ内のモデル構築要否の選択（既定は汎用モデルを使う）。begin で確定し store に渡す。
  const [modelMode, setModelMode] = useState<ModelMode>("generic");

  const handleBegin = (): void => {
    tutorialStore.begin(modelMode);
    // DB 接続基本: 実際の名寄せ作成画面から本物の工程を開始する。
    // 各工程の完了 footer (preprocess/ml/result) が次工程へハンドオフする。
    navigate(ROUTES.NORMALIZATION.CREATE);
  };

  const handleResume = async (): Promise<void> => {
    tutorialStore.resume();
    await goToResume();
  };

  const currentLabel = stage ? TUTORIAL_STAGES[stage].label : "";

  return (
    <>
      {/* 起動ダイアログ */}
      <Dialog
        onOpenChange={(_, data) => {
          if (!data.open) tutorialStore.closeLaunch();
        }}
        open={launchOpen}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t.launchTitle}</DialogTitle>
            <DialogContent>
              <div className={styles.section}>
                <span className={styles.heading}>{t.launchFlowHeading}</span>
                <ol className={styles.flow}>
                  <li>{t.flowNormalization}</li>
                  <li>{t.flowModel}</li>
                  <li>{t.flowEvaluation}</li>
                  <li>{t.flowAnalysis}</li>
                </ol>
              </div>
              <div className={styles.section}>
                <span className={styles.heading}>{t.modelChoiceHeading}</span>
                <RadioGroup
                  onChange={(_, data) => setModelMode(data.value as ModelMode)}
                  value={modelMode}
                >
                  <Radio
                    label={
                      <span className={styles.radioLabel}>
                        <span>{t.modelGenericLabel}</span>
                        <span className={styles.radioDesc}>
                          {t.modelGenericDesc}
                        </span>
                      </span>
                    }
                    value="generic"
                  />
                  <Radio
                    label={
                      <span className={styles.radioLabel}>
                        <span>{t.modelBuildLabel}</span>
                        <span className={styles.radioDesc}>
                          {t.modelBuildDesc}
                        </span>
                      </span>
                    }
                    value="build"
                  />
                </RadioGroup>
              </div>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="outline"
                onClick={() => tutorialStore.closeLaunch()}
              >
                {t.later}
              </Button>
              <Button appearance="primary" onClick={handleBegin}>
                {t.begin}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* 再開確認ダイアログ */}
      <Dialog
        onOpenChange={(_, data) => {
          if (!data.open) tutorialStore.closeResume();
        }}
        open={resumeOpen}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t.resumeTitle}</DialogTitle>
            <DialogContent>
              {currentLabel
                ? t.resumeBody.replace("{label}", currentLabel)
                : t.resumeBodyFallback}
            </DialogContent>
            <DialogActions>
              <Button
                appearance="outline"
                onClick={() => {
                  tutorialStore.reset();
                  tutorialStore.openLaunch();
                }}
              >
                {t.fromStart}
              </Button>
              <Button appearance="primary" onClick={() => void handleResume()}>
                {t.resume}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* 終了確認ダイアログ */}
      <Dialog
        onOpenChange={(_, data) => {
          if (!data.open) tutorialStore.closeEndConfirm();
        }}
        open={endConfirmOpen}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t.endTitle}</DialogTitle>
            <DialogContent>{t.endBody}</DialogContent>
            <DialogActions>
              <Button
                appearance="outline"
                onClick={() => tutorialStore.closeEndConfirm()}
              >
                {t.cancel}
              </Button>
              <Button
                appearance="primary"
                onClick={() => tutorialStore.reset()}
              >
                {t.end}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* 完了ダイアログ */}
      <Dialog
        onOpenChange={(_, data) => {
          if (!data.open) tutorialStore.closeComplete();
        }}
        open={completeOpen}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t.completeTitle}</DialogTitle>
            <DialogContent>{t.completeBody}</DialogContent>
            <DialogActions>
              <Button
                appearance="primary"
                onClick={() => tutorialStore.complete()}
              >
                {t.close}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <TutorialGuide />
    </>
  );
};
