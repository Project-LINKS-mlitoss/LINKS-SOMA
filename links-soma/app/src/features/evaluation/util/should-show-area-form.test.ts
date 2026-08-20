import { describe, it, expect } from "vitest";
import { type NormalizedDatasetGeometrySource } from "../../dataset/ipc/select-normalized-dataset-geometry-sources";
import { shouldShowAreaForm } from "./should-show-area-form";

const geocoded = (path: string): NormalizedDatasetGeometrySource => ({
  path,
  determinable: true,
  hasGeocoding: true,
});
const noGeocoding = (path: string): NormalizedDatasetGeometrySource => ({
  path,
  determinable: true,
  hasGeocoding: false,
});
const undeterminable = (path: string): NormalizedDatasetGeometrySource => ({
  path,
  determinable: false,
  hasGeocoding: false,
});

describe("shouldShowAreaForm（地域集計フォームの表示判定・#1924）", () => {
  it("未選択なら非表示", () => {
    expect(shouldShowAreaForm([], [], false)).toBe(false);
  });

  it("初回判定ロード中（sources undefined）は非表示（点滅回避）", () => {
    expect(shouldShowAreaForm(["a.csv"], undefined, false)).toBe(false);
  });

  it("fetch 失敗時は安全側で表示（黙って地域集計を落とさない）", () => {
    expect(shouldShowAreaForm(["a.csv"], undefined, true)).toBe(true);
  });

  it("ジオコーディングありは表示", () => {
    expect(shouldShowAreaForm(["a.csv"], [geocoded("a.csv")], false)).toBe(
      true,
    );
  });

  it("ジオコーディング未使用と確定したら非表示", () => {
    expect(shouldShowAreaForm(["a.csv"], [noGeocoding("a.csv")], false)).toBe(
      false,
    );
  });

  it("判定不能（アップロード直挿し等）は安全側で表示", () => {
    expect(
      shouldShowAreaForm(["a.csv"], [undeterminable("a.csv")], false),
    ).toBe(true);
  });

  it("ソースに無いパス（登録前の一時状態等）は安全側で表示", () => {
    expect(shouldShowAreaForm(["a.csv"], [], false)).toBe(true);
  });

  it("複数選択は1つでもジオコーディングありなら表示", () => {
    expect(
      shouldShowAreaForm(
        ["a.csv", "b.csv"],
        [noGeocoding("a.csv"), geocoded("b.csv")],
        false,
      ),
    ).toBe(true);
  });

  it("複数選択で全てジオコーディング未使用なら非表示", () => {
    expect(
      shouldShowAreaForm(
        ["a.csv", "b.csv"],
        [noGeocoding("a.csv"), noGeocoding("b.csv")],
        false,
      ),
    ).toBe(false);
  });
});
