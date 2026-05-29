import { type Map as MapLibreMap, Popup } from "maplibre-gl";
import { useCallback, useRef } from "react";
import { POPUP_ELEMENT_IDS } from "../../components/views/map/map-container/const";
import {
  createToggleClickHandler,
  type OverlapNavigationCallback,
  setupOverlapNavigationListeners,
  updateOverlapNavigationDisplay,
} from "../../util/map/popup-dom-utils";

export type PopupOpenHandler = (popup: Popup) => void;
export type PopupCloseHandler = () => void;

export type UsePopupLifecycleReturn = {
  /** ポップアップを表示 */
  showPopup: (
    content: string,
    coordinates: [number, number],
    handlers: {
      onOpen?: PopupOpenHandler;
      onClose?: PopupCloseHandler;
    },
  ) => void;
  /** ポップアップをクリアし、すべてのリソースを解放 */
  clearPopup: () => void;
  /** トグルボタンのリスナーを設定 */
  setupToggleListener: (popup: Popup) => void;
  /** 重複ナビゲーションリスナーを設定 */
  setupNavigationListeners: (
    popup: Popup,
    onNavigate: OverlapNavigationCallback,
    currentIndex: number,
    maxIndex: number,
  ) => void;
};

/**
 * ポップアップの生成・破棄・イベント管理を行うフック
 *
 * メモリ管理の設計方針:
 * - すべてのpopup関連オブジェクトをrefで管理し、クロージャによる参照チェーンを防ぐ
 * - イベントハンドラはpopupを直接キャプチャせず、refを経由してアクセス
 * - クリーンアップ時にすべてのrefをnullにして参照を明示的に解放
 */
export const usePopupLifecycle = ({
  mapInstance,
}: {
  mapInstance: MapLibreMap | null;
}): UsePopupLifecycleReturn => {
  const popupRef = useRef<Popup | null>(null);

  // クリーンアップ関数を保持するref
  const cleanupToggleRef = useRef<(() => void) | null>(null);
  const cleanupNavigationRef = useRef<(() => void) | null>(null);

  // イベントハンドラをrefで保持（クロージャによる参照チェーンを防ぐ）
  const handlePopupOpenRef = useRef<(() => void) | null>(null);
  const handlePopupCloseRef = useRef<(() => void) | null>(null);

  /**
   * ポップアップのクリーンアップを実行する
   * すべてのイベントリスナーを解除し、refをnullにして参照チェーンを断ち切る
   */
  const clearPopup = useCallback((): void => {
    // トグルボタンのクリーンアップ
    if (cleanupToggleRef.current) {
      cleanupToggleRef.current();
      cleanupToggleRef.current = null;
    }
    // ナビゲーションリスナーのクリーンアップ
    if (cleanupNavigationRef.current) {
      cleanupNavigationRef.current();
      cleanupNavigationRef.current = null;
    }
    // ポップアップのイベントリスナー解除とremove
    const popup = popupRef.current;
    const openHandler = handlePopupOpenRef.current;
    const closeHandler = handlePopupCloseRef.current;

    if (popup) {
      if (openHandler) popup.off("open", openHandler);
      if (closeHandler) popup.off("close", closeHandler);
      popup.remove();
    }

    // すべてのrefをnullにして参照チェーンを断ち切る
    popupRef.current = null;
    handlePopupOpenRef.current = null;
    handlePopupCloseRef.current = null;
  }, []);

  const showPopup = useCallback(
    (
      content: string,
      coordinates: [number, number],
      handlers: {
        onOpen?: PopupOpenHandler;
        onClose?: PopupCloseHandler;
      },
    ) => {
      if (!mapInstance) return;

      // 既存のポップアップをクリア
      clearPopup();

      // 新しいポップアップを作成
      const popup = new Popup();
      popupRef.current = popup;

      // openハンドラ
      const handlePopupOpen = (): void => {
        const currentPopup = popupRef.current;
        if (!currentPopup) return;
        handlers.onOpen?.(currentPopup);
      };

      /**
       * closeハンドラ
       * ×ボタンで閉じた場合、MapLibreが直接popup.remove()を呼ぶため、React状態を同期する必要がある
       */
      const handlePopupClose = (): void => {
        // popupRef.currentがnullの場合、既にプログラム的にクリーンアップ済み
        if (!popupRef.current) return;

        // イベントリスナーのクリーンアップ
        if (cleanupToggleRef.current) {
          cleanupToggleRef.current();
          cleanupToggleRef.current = null;
        }
        if (cleanupNavigationRef.current) {
          cleanupNavigationRef.current();
          cleanupNavigationRef.current = null;
        }

        // ポップアップイベントの解除
        const currentPopup = popupRef.current;
        const openHandler = handlePopupOpenRef.current;
        const closeHandler = handlePopupCloseRef.current;

        if (currentPopup && openHandler) currentPopup.off("open", openHandler);
        if (currentPopup && closeHandler)
          currentPopup.off("close", closeHandler);

        // refをnullにして参照チェーンを断ち切る
        popupRef.current = null;
        handlePopupOpenRef.current = null;
        handlePopupCloseRef.current = null;

        // コールバックを呼び出し
        handlers.onClose?.();
      };

      // ハンドラをrefに保存
      handlePopupOpenRef.current = handlePopupOpen;
      handlePopupCloseRef.current = handlePopupClose;

      popup.on("open", handlePopupOpen);
      popup.on("close", handlePopupClose);
      popup.setLngLat(coordinates).setHTML(content).addTo(mapInstance);
    },
    [mapInstance, clearPopup],
  );

  const setupToggleListener = useCallback((popup: Popup) => {
    const popupElement = popup.getElement();
    const toggleButton = popupElement?.querySelector(
      `#${POPUP_ELEMENT_IDS.TOGGLE_BUTTON}`,
    ) as HTMLButtonElement;

    if (toggleButton) {
      const handleToggleClick = createToggleClickHandler(popup);
      toggleButton.addEventListener("click", handleToggleClick);
      cleanupToggleRef.current = () => {
        toggleButton.removeEventListener("click", handleToggleClick);
      };
    }
  }, []);

  const setupNavigationListeners = useCallback(
    (
      popup: Popup,
      onNavigate: OverlapNavigationCallback,
      currentIndex: number,
      maxIndex: number,
    ) => {
      cleanupNavigationRef.current = setupOverlapNavigationListeners(
        popup,
        onNavigate,
      );

      // 初期状態でボタンの状態を更新
      updateOverlapNavigationDisplay(popup, currentIndex, maxIndex);
    },
    [],
  );

  return {
    showPopup,
    clearPopup,
    setupToggleListener,
    setupNavigationListeners,
  };
};
