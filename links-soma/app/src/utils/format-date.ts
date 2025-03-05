import dayjs, { extend } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

export const formatDate = (
  date: string | number | Date,
  formatString?: string,
): string => {
  extend(utc);
  extend(timezone);
  const dayjsJapan = dayjs.utc(date).tz("Asia/Tokyo");

  if (!dayjsJapan.isValid()) return "";
  if (formatString) return dayjsJapan.format(formatString);
  return dayjsJapan.format("YYYY/MM/DD HH:mm:ss");
};
