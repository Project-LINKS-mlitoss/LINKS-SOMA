import { RouterProvider } from "react-router-dom";
import {
  FluentProvider,
  createLightTheme,
  type BrandVariants,
} from "@fluentui/react-components";
import { SWRConfig } from "swr";
import { getSWRConfig } from "./shared/utils/swr-config";
import { router } from "./router";
import "./shared/styles/global.css";

const myNewTheme: BrandVariants = {
  10: "#020204",
  20: "#16151E",
  30: "#232235",
  40: "#2D2D48",
  50: "#39395B",
  60: "#444570",
  70: "#505185",
  80: "#5B5D9B",
  90: "#696AAB",
  100: "#7979B4",
  110: "#8887BD",
  120: "#9796C5",
  130: "#A7A5CE",
  140: "#B6B4D7",
  150: "#C6C4DF",
  160: "#D5D4E8",
};

const theme = createLightTheme(myNewTheme);

export function App(): JSX.Element {
  return (
    <FluentProvider theme={theme}>
      <SWRConfig value={getSWRConfig()}>
        <RouterProvider router={router} />
      </SWRConfig>
    </FluentProvider>
  );
}
