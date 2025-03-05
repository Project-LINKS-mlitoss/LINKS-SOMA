import { memo } from "react";
import { Checkbox, makeStyles } from "@fluentui/react-components";
import { type FetchAreaGroupsArg } from "../../ipc-main-listeners/select-area-groups";

const useStyles = makeStyles({
  options: {
    height: "300px",
    overflowX: "scroll",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gridAutoRows: "32px",
    width: "100%",
  },
});

type Props = FetchAreaGroupsArg & {
  selectedAreas: string[];
  onChange: (value: string[]) => void;
  searchFilteredData: string[] | undefined;
};

/**
 * 地域フィルタ用の選択肢表示用コンポーネント
 */
export const FormAreaFilterOptions = memo((props: Props) => {
  const styles = useStyles();

  return (
    <div className={styles.options}>
      {props.searchFilteredData?.map((area, index) => {
        return (
          <div key={index}>
            <Checkbox
              checked={props.selectedAreas.includes(area)}
              id={area}
              label={area}
              name={area}
              onChange={(e) => {
                const data = (): string[] => {
                  if (e.target.checked) {
                    if (props.selectedAreas.includes(area)) {
                      return props.selectedAreas;
                    }
                    return [...props.selectedAreas, area].sort();
                  } else {
                    return props.selectedAreas
                      .filter((selectedArea) => selectedArea !== area)
                      .sort();
                  }
                };

                props.onChange(data());
              }}
            />
          </div>
        );
      })}
    </div>
  );
});

FormAreaFilterOptions.displayName = "AreaFilterFormOptions";
