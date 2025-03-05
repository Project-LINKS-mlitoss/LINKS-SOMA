import { useEffect, useState } from "react";
import { makeStyles, tokens } from "@fluentui/react-components";
import { useFetchReferenceDates } from "../../../hooks/use-fetch-reference-dates";
import { type SelectDataSetResult } from "../../../schema";
import { type MapView } from "../../../bi-modules/interfaces/view";
import {
  AREA_DATASET_COLUMN_METADATA,
  BUILDING_DATASET_COLUMN_METADATA,
} from "../../../config/column-metadata";
import { TextWithTooltip } from "../../ui/text-with-tooltip";
import {
  VacancyLevelCheckbox,
  type VacancyLevels,
} from "./vacancy-level-checkbox";
import { MapComponent } from "./map-component";
import { ReferenceDateDropdown } from "./reference-date-dropdown";

const useStyles = makeStyles({
  filters: {
    display: "flex",
    gap: tokens.spacingHorizontalXXL,
  },
  filter: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
  },
  map: {
    marginTop: tokens.spacingVerticalMNudge,
  },
});

export interface MapProps {
  dataSetResultId: SelectDataSetResult["id"];
  view: MapView;
}

export function Map({ dataSetResultId, view }: MapProps): JSX.Element {
  const { unit, parameters } = view;
  const areaFilter = parameters.find((p) => p.key === "area");

  const styles = useStyles();
  const [vacancyLevels, setVacancyLevels] = useState<VacancyLevels>({
    low: true,
    medium: true,
    high: true,
  });
  const { data: referenceDates } = useFetchReferenceDates({
    dataSetResultId,
  });
  const [selectedDate, setSelectedDate] = useState<string | undefined>(
    referenceDates?.[0],
  );

  useEffect(
    function fetchReferenceDatesEffect() {
      if (!referenceDates) return;
      setSelectedDate(
        (prevSelectedDate) => prevSelectedDate || referenceDates[0],
      );
    },
    [referenceDates],
  );

  const meta =
    unit === "area"
      ? AREA_DATASET_COLUMN_METADATA["predicted_probability"]
      : BUILDING_DATASET_COLUMN_METADATA["predicted_probability"];

  return (
    <div>
      <div className={styles.filters}>
        <div className={styles.filter}>
          <div>
            <TextWithTooltip
              textNode={meta.label}
              tooltipContent={meta.description}
            />
          </div>
          <div>
            <VacancyLevelCheckbox
              setVacancyLevels={setVacancyLevels}
              unit={unit}
              vacancyLevels={vacancyLevels}
            />
          </div>
        </div>
        <div className={styles.filter}>
          <div>推定日</div>
          <div>
            <ReferenceDateDropdown
              referenceDates={referenceDates}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
            />
          </div>
        </div>
      </div>
      <div className={styles.map}>
        <MapComponent
          areas={areaFilter?.value}
          dataSetResultId={dataSetResultId}
          selectedDate={selectedDate}
          unit={unit}
          vacancyLevels={vacancyLevels}
        />
      </div>
    </div>
  );
}
