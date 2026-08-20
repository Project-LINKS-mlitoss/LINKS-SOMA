import { NavDrawer, NavDrawerBody, NavItem } from "@fluentui/react-nav-preview";

import {
  Divider,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import {
  ArrowTrendingLinesRegular,
  HomeRegular,
  DatabaseRegular,
  FolderRegular,
  ArrowSyncCircleRegular,
  TableSwitchRegular,
  SettingsRegular,
} from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { SIDEBAR_WIDTH } from "../config/layout-constants";
import { TutorialOverlay } from "../tutorial/overlay";

const useStyles = makeStyles({
  navDrawer: {
    width: SIDEBAR_WIDTH,
    height: "100vh",
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalNone}`,
    backgroundColor: tokens.colorBrandBackground,
    position: "fixed",
  },
  navDrawerBody: {
    padding: `${tokens.spacingVerticalNone} ${tokens.spacingHorizontalMNudge}`,
  },
  navItem: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalNone}`,
    backgroundColor: tokens.colorTransparentBackground,
    color: tokens.colorNeutralForegroundInverted,
    "&:hover": {
      color: tokens.colorBrandBackground,
    },
    ":after": {
      content: "none",
    },
  },
  menuItem: {
    display: "flex",
    flexFlow: "column",
    gap: tokens.spacingVerticalXS,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  icon: {
    width: tokens.spacingHorizontalXXL,
    height: tokens.spacingVerticalXXL,
  },
  label: {
    fontSize: tokens.fontSizeBase100,
  },
  isActive: {
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorBrandBackground,
    fontWeight: tokens.fontWeightSemibold,
  },
  /** 処理群と管理群の境界の Divider。濃いブランド背景では既定線色が不可視のため、薄い白系で上書き。 */
  groupDivider: {
    // Fluent Divider は既定 flexGrow:1。flex column の NavDrawerBody 内で縦に伸びて
    // 空白を食うため 0 に固定し、線本来の高さに戻す。
    flexGrow: 0,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    "::before": {
      borderTopColor: "rgba(255, 255, 255, 0.16)",
    },
    "::after": {
      borderTopColor: "rgba(255, 255, 255, 0.16)",
    },
  },
});

/**
 * @ref createHashRouter
 */
// 処理群（名寄せ → モデル構築 → 空き家推定 → 分析）を処理順に並べ、
// 続けて管理群（データセット / 処理一覧）。GROUP_BOUNDARY 以降が管理群。
const GROUP_BOUNDARY = 4;
const menuItems = [
  {
    icon: TableSwitchRegular,
    label: "名寄せ処理",
    value: "1",
    href: "#normalization",
  },
  {
    icon: DatabaseRegular,
    label: "モデル構築",
    value: "2",
    href: "#model",
  },
  {
    icon: HomeRegular,
    label: "空き家推定",
    value: "3",
    href: "#evaluation",
  },
  {
    icon: ArrowTrendingLinesRegular,
    label: "分析",
    value: "4",
    href: "#analysis/workbook",
  },
  {
    icon: FolderRegular,
    label: "データセット",
    value: "5",
    href: "#dataset",
  },
  {
    icon: ArrowSyncCircleRegular,
    label: "処理一覧",
    value: "6",
    href: "#job",
  },
] as const;

export const Sidebar = (): JSX.Element => {
  const styles = useStyles();

  const [selectedValue, setSelectedValue] = useState("");

  /** グローバルナビ以外をクリックして画面遷移することもあるのでstateを直接書き換える必要がある */
  const { pathname } = useLocation();
  useEffect(() => {
    const value =
      menuItems.find((item) =>
        pathname.replace("/", "").includes(item.href.replace("#", "")),
      )?.value || "99";
    if (value) {
      setSelectedValue(value);
    }
  }, [pathname, selectedValue]);

  const renderItem = (item: (typeof menuItems)[number]): JSX.Element => {
    const isActive = selectedValue === item.value;
    return (
      <NavItem
        key={item.value}
        className={mergeClasses(
          styles.navItem,
          isActive ? styles.isActive : "",
        )}
        href={item.href}
        value={item.value}
      >
        <div className={styles.menuItem}>
          <item.icon className={styles.icon} />
          <div className={styles.label}>{item.label}</div>
        </div>
      </NavItem>
    );
  };

  return (
    <>
      <NavDrawer
        className={styles.navDrawer}
        defaultSelectedValue="4"
        onNavItemSelect={(_, data) => setSelectedValue(data.value as string)}
        open
        type="inline"
      >
        <NavDrawerBody className={styles.navDrawerBody}>
          {menuItems.slice(0, GROUP_BOUNDARY).map(renderItem)}
          <Divider className={styles.groupDivider} />
          {menuItems.slice(GROUP_BOUNDARY).map(renderItem)}

          <NavItem
            key="99"
            className={mergeClasses(
              styles.navItem,
              selectedValue === "99" ? styles.isActive : "",
            )}
            href="#app-info"
            style={{ marginTop: "auto" }}
            value="99"
          >
            <div className={styles.menuItem}>
              <SettingsRegular className={styles.icon} />
              <div className={styles.label}>アプリ情報</div>
            </div>
          </NavItem>
        </NavDrawerBody>
      </NavDrawer>
      <TutorialOverlay />
    </>
  );
};
