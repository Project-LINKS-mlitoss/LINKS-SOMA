import { Body1, tokens } from "@fluentui/react-components";

/** 抽象的なエラーコンポーネント */
export const ErrorMessage = ({ msg }: { msg: string }): JSX.Element => {
  return (
    <div
      style={{
        color: "#C4314B",
        backgroundColor: "rgba(196, 49, 75, 0.12)",
        padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
      }}
    >
      <Body1>{msg}</Body1>
    </div>
  );
};
