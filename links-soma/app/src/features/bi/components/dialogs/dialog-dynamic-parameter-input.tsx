import {
  Body1,
  Dialog,
  DialogTrigger,
  makeStyles,
  Subtitle2,
  tokens,
} from "@fluentui/react-components";
import { Dismiss24Regular, InfoFilled } from "@fluentui/react-icons";
import {
  Button,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
} from "../../../../shared/components/ui";
import { type TileViewFieldOption } from "../../types/models/charts";
import { lang } from "../../../../shared/config/lang";
import { translateColumnToJapanese } from "../../../../shared/column-translation-utils";

const useStyles = makeStyles({
  icon: {
    fontSize: tokens.fontSizeBase500,
    color: tokens.colorBrandBackground,
  },
  contentContainer: {
    display: "grid",
    gap: tokens.spacingVerticalXXL,
    paddingBottom: tokens.spacingVerticalM,
  },
  metaData: {
    display: "grid",
    gap: tokens.spacingVerticalM,
  },
});

type Props = {
  fieldOption: TileViewFieldOption;
};

export const DialogDynamicParameterInput = ({
  fieldOption,
}: Props): JSX.Element => {
  const styles = useStyles();

  const metaData = fieldOption.option.map((option) => {
    const columns =
      option.unit === "building" ? lang.columns.building : lang.columns.area;
    const columnData = columns[option.value as keyof typeof columns];
    const label = translateColumnToJapanese(option.value, option.unit);
    const description = columnData?.description ?? "";
    return { label, description };
  });

  return (
    <Dialog>
      <DialogTrigger disableButtonEnhancement>
        <Button
          appearance="subtle"
          icon={<InfoFilled className={styles.icon} />}
        />
      </DialogTrigger>
      <DialogSurface>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button
                  appearance="subtle"
                  aria-label="close"
                  icon={
                    <Dismiss24Regular
                      color={tokens.colorNeutralForeground1}
                      strokeWidth={2}
                    />
                  }
                />
              </DialogTrigger>
            }
          >
            {`「${fieldOption.label}」に設定可能なカラムについて`}
          </DialogTitle>
          <DialogContent>
            <div className={styles.contentContainer}>
              {metaData.map((option) => (
                <div key={option.label} className={styles.metaData}>
                  <Subtitle2>{option.label}</Subtitle2>
                  <Body1>{option.description}</Body1>
                </div>
              ))}
            </div>
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
