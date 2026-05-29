import { useEffect } from "react";
import {
  Card,
  makeStyles,
  Tab,
  TabList,
  tokens,
} from "@fluentui/react-components";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RawDataSetTable } from "../components/dataset/raw-dataset-table";
import { NormalizedDataSetTable } from "../components/dataset/normalized-dataset-table";
import { ResultDataSetTable } from "../components/dataset/result-dataset-table";
import {
  BreadcrumbBase,
  BreadcrumbItem,
} from "../../../shared/components/ui/breadcrumb";
import { ROUTES } from "../../../shared/config/routes";

const useStyles = makeStyles({
  root: {
    display: "grid",
    gap: tokens.spacingVerticalL,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalL,
  },
  heading: {
    fontSize: tokens.fontSizeBase500,
    lineHeight: tokens.lineHeightBase600,
  },
  content: {
    display: "block",
    minHeight: "300px",
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
  },
});

const TAB_VALUES = ["raw", "normalization", "result"] as const;
type TabValue = (typeof TAB_VALUES)[number];

export function Dataset(): JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();

  const [URLSearchParams] = useSearchParams();
  const tab = URLSearchParams.get("tab") as TabValue | null;

  /** tabがクエリパラメータにない場合 */
  useEffect(() => {
    if (tab) return;
    navigate(
      ROUTES.DATASET({
        queryParams: {
          tab: "raw",
        },
      }),
    );
  }, [tab, navigate]);

  return (
    <div className={styles.root}>
      <BreadcrumbBase
        breadcrumbItem={[
          {
            href: ROUTES.DATASET({}),
            current: true,
            children: "データセット管理",
          },
        ].map((item) => (
          <BreadcrumbItem key={item.href} {...item} />
        ))}
      />
      <div className={styles.header}>
        <h2 className={styles.heading}>データセット管理</h2>
        <TabList
          onTabSelect={(e, data) => {
            if (!data.value || typeof data.value !== "string") return;
            navigate(
              ROUTES.DATASET({
                queryParams: {
                  tab: data.value,
                },
              }),
            );
          }}
          selectedValue={tab}
        >
          {TAB_VALUES.map((value) => (
            <Tab key={value} value={value}>
              {
                {
                  raw: "インプットデータ",
                  normalization: "名寄せ処理済データ",
                  result: "空き家推定結果データ",
                }[value]
              }
            </Tab>
          ))}
        </TabList>
      </div>
      <Card className={styles.content}>
        {tab &&
          {
            raw: <RawDataSetTable />,
            normalization: <NormalizedDataSetTable />,
            result: <ResultDataSetTable />,
          }[tab]}
      </Card>
    </div>
  );
}
