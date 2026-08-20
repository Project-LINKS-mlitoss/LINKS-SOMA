import { describe, expect, it } from "vitest";
import { type SelectJob } from "../../../db/schema";
import { type PreprocessParameters } from "../../../shared/types/job-parameters";
import {
  hasAnyColumnMapping,
  pickPreviousMapping,
} from "./pick-previous-mapping";

/** geocoding に address を割り当てた最小マッピング override */
const GEO_MAPPED = {
  geocoding: {
    id: 1,
    path: "geo.csv",
    columns: { address: "住所", latitude: "", longitude: "" },
  },
};

/** テスト用に最小構成の preprocess data を組む */
const makeData = (
  overrides: Record<string, unknown> = {},
): PreprocessParameters["data"] =>
  ({
    water_status: {
      id: undefined,
      path: undefined,
      columns: {
        water_supply_number: "",
        water_disconnection_date: "",
        water_connection_date: "",
        address: "",
      },
    },
    ...overrides,
  }) as unknown as PreprocessParameters["data"];

/** テスト用に最小構成の preprocess job を組む */
const makeJob = (over: {
  id: number;
  status: SelectJob["status"];
  createdAt: string;
  data?: PreprocessParameters["data"];
}): SelectJob =>
  ({
    id: over.id,
    status: over.status,
    type: "preprocess",
    process_id: null,
    is_named: false,
    parameters: {
      parameterType: "preprocess",
      data: over.data ?? makeData(),
    },
    created_at: over.createdAt,
    updated_at: over.createdAt,
  }) as unknown as SelectJob;

describe("hasAnyColumnMapping", () => {
  it("いずれかのカラムに非空値があれば true", () => {
    expect(hasAnyColumnMapping(makeData(GEO_MAPPED))).toBe(true);
  });

  it("全カラムが空文字なら false", () => {
    expect(hasAnyColumnMapping(makeData())).toBe(false);
  });
});

describe("pickPreviousMapping", () => {
  it("status=complete かつマッピング有りの最新ジョブを返す", () => {
    const data = makeData(GEO_MAPPED);
    const jobs = [
      makeJob({ id: 3, status: "complete", createdAt: "2026-06-01", data }),
      makeJob({ id: 2, status: "complete", createdAt: "2026-05-01", data }),
    ];

    const result = pickPreviousMapping(jobs);

    expect(result?.jobId).toBe(3);
    expect(result?.createdAt).toBe("2026-06-01");
    expect(result?.data).toBe(data);
  });

  it("complete 以外（error / 実行中 / draft / null）は対象外", () => {
    const data = makeData(GEO_MAPPED);
    const jobs = [
      makeJob({ id: 4, status: "error", createdAt: "2026-06-04", data }),
      makeJob({ id: 3, status: "", createdAt: "2026-06-03", data }),
      makeJob({ id: 2, status: "draft", createdAt: "2026-06-02", data }),
      makeJob({ id: 1, status: null, createdAt: "2026-06-01", data }),
    ];

    expect(pickPreviousMapping(jobs)).toBeNull();
  });

  it("マッピングが空のジョブは飛ばし、次の有効なジョブを返す", () => {
    const jobs = [
      makeJob({
        id: 3,
        status: "complete",
        createdAt: "2026-06-03",
        data: makeData(),
      }),
      makeJob({
        id: 2,
        status: "complete",
        createdAt: "2026-06-02",
        data: makeData(GEO_MAPPED),
      }),
    ];

    expect(pickPreviousMapping(jobs)?.jobId).toBe(2);
  });

  it("excludeJobId と一致するジョブは選ばない", () => {
    const data = makeData(GEO_MAPPED);
    const jobs = [
      makeJob({ id: 3, status: "complete", createdAt: "2026-06-03", data }),
      makeJob({ id: 2, status: "complete", createdAt: "2026-06-02", data }),
    ];

    expect(pickPreviousMapping(jobs, 3)?.jobId).toBe(2);
  });

  it("該当ジョブが無ければ null", () => {
    expect(pickPreviousMapping([])).toBeNull();
  });
});
