import { describe, expect, it } from "vitest";
import { type SelectJob } from "../../../db/schema";
import { lang } from "../../../shared/config/lang";
import { jobStatusLabel, toJobStatusSection } from "./job-status-rows";

const l = lang.components["job-parameters-section"];

/** jobs の1行。テストで使うフィールドだけ埋める */
const job = (overrides: Partial<SelectJob>): SelectJob =>
  ({
    id: 1,
    status: "complete",
    type: "ml",
    process_id: null,
    is_named: false,
    parameters: { parameterType: "unknown" },
    created_at: "2026-08-14 10:00:00",
    updated_at: "2026-08-14 10:00:00",
    ...overrides,
  }) as SelectJob;

describe("jobStatusLabel", () => {
  it("完了・失敗・下書きをそれぞれの表示ラベルにする", () => {
    expect(jobStatusLabel("complete")).toBe(l.jobStatusLabels.complete);
    expect(jobStatusLabel("error")).toBe(l.jobStatusLabels.error);
    expect(jobStatusLabel("draft")).toBe(l.jobStatusLabels.draft);
  });

  it("空文字と null はどちらも実行中にする。DB は実行中を空文字で持ち、未記録は null になるため", () => {
    expect(jobStatusLabel("")).toBe(l.jobStatusLabels.processing);
    expect(jobStatusLabel(null)).toBe(l.jobStatusLabels.processing);
  });

  it("enum 外の status も実行中に寄せる。ラベルが空のまま出力されるのを避けるため", () => {
    expect(jobStatusLabel("running" as SelectJob["status"])).toBe(
      l.jobStatusLabels.processing,
    );
  });
});

describe("toJobStatusSection", () => {
  it("状態の1行だけを持つセクションにする", () => {
    expect(toJobStatusSection(job({ status: "complete" }))).toEqual({
      title: l.jobStatusSection,
      rows: [[l.jobStatusLabel, l.jobStatusLabels.complete]],
    });
  });

  it("実行中でもセクションを出す。途中経過のファイルだとファイル単体で読み取れるようにするため", () => {
    expect(toJobStatusSection(job({ status: "" })).rows).toEqual([
      [l.jobStatusLabel, l.jobStatusLabels.processing],
    ]);
  });
});
