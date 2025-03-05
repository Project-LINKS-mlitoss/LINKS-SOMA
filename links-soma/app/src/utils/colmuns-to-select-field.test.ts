import { describe, expect, it } from "vitest";
import {
  data_set_detail_buildings,
  type SelectDataSetDetailArea,
  type SelectDataSetDetailBuilding,
} from "../schema";
import { columnsToSelectField } from "./columns-to-select-field";

describe("表形式でのView表示向けのデータフィルタリング機能のテスト", () => {
  it("集計単位が建物の場合に指定したKeyの配列から、select向けのオブジェクトに変換する", () => {
    const keys = [
      "normalized_address",
      "name",
    ] satisfies (keyof SelectDataSetDetailBuilding)[];

    const obj = columnsToSelectField({ type: "building", columns: keys });

    expect(obj).toEqual({
      normalized_address: data_set_detail_buildings.normalized_address,
      name: data_set_detail_buildings.name,
    });
  });

  it("集計単位が地域の場合に指定したKeyの配列から、select向けのオブジェクトに変換する", () => {
    const keys = [
      "id",
      "created_at",
    ] satisfies (keyof SelectDataSetDetailArea)[];

    const obj = columnsToSelectField({ type: "building", columns: keys });

    expect(obj).toEqual({
      id: data_set_detail_buildings.id,
      created_at: data_set_detail_buildings.created_at,
    });
  });
});
