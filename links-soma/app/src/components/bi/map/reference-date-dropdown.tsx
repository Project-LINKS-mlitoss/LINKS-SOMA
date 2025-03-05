import { Dropdown, Option } from "@fluentui/react-components";

interface Props {
  selectedDate: string | undefined;
  setSelectedDate: (date: string | undefined) => void;
  referenceDates: string[] | undefined;
}

export function ReferenceDateDropdown({
  selectedDate,
  setSelectedDate,
  referenceDates,
}: Props): JSX.Element | null {
  if (!selectedDate) return null;

  return (
    <Dropdown
      defaultSelectedOptions={[selectedDate]}
      defaultValue={selectedDate}
      onOptionSelect={(_, data) => setSelectedDate(data.optionValue)}
    >
      {referenceDates?.map((date) => (
        <Option key={date} value={date}>
          {date}
        </Option>
      ))}
    </Dropdown>
  );
}
