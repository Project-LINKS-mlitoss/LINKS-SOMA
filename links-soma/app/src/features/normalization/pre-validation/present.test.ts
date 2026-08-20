import { describe, expect } from "vitest";
import { toDisplay } from "./present";
import type { Rule } from "./types";

const rule = (impact?: "stop" | "continue"): Rule => ({
  dataset: "water_status",
  column: "水道番号",
  aspect: "uniqueness",
  impact,
});

describe("toDisplay（三値→画面表示の意味づけ）", (it) => {
  it("clear は ok", () => {
    const d = toDisplay({
      rule: rule("continue"),
      verdict: { status: "clear", detail: "重複なし" },
    });
    expect(d.status).toBe("ok");
  });

  it("issue かつ 停止系（stop）は error", () => {
    const d = toDisplay({
      rule: rule("stop"),
      verdict: { status: "issue", detail: "重複あり" },
    });
    expect(d.status).toBe("error");
  });

  it("issue かつ 継続系（continue）は warn", () => {
    const d = toDisplay({
      rule: rule("continue"),
      verdict: { status: "issue", detail: "重複あり" },
    });
    expect(d.status).toBe("warn");
  });

  it("unknown は pending。文言は検出器の reason を通す", () => {
    const d = toDisplay({
      rule: rule("continue"),
      verdict: { status: "unknown", reason: "全件は処理時に確定" },
    });
    expect(d.status).toBe("pending");
    expect(d.message).toBe("全件は処理時に確定");
  });

  it("PV コードを付与する", () => {
    const d = toDisplay({
      rule: rule("continue"),
      verdict: { status: "clear" },
    });
    expect(d.code).toBe("PV-07");
  });
});
