export const formatByteValue = (
  bytes: number,
  options?: {
    unit: "B" | "KB" | "MB" | "GB" | "TB";
  },
): string => {
  if (bytes < 0) {
    return "0 B";
  }
  if (!options) {
    return `${bytes} B`;
  }
  const { unit } = options;

  switch (unit) {
    case "B":
      return `${bytes} B`;
    case "KB":
      return `${(bytes / 1024).toFixed(2)} KB`;
    case "MB":
      return `${(bytes / Math.pow(1024, 2)).toFixed(2)} MB`;
    case "GB":
      return `${(bytes / Math.pow(1024, 3)).toFixed(2)} GB`;
    case "TB":
      return `${(bytes / Math.pow(1024, 4)).toFixed(2)} TB`;
    default:
      return `${bytes} B`;
  }
};

if (import.meta.vitest) {
  const { test, expect, describe } = import.meta.vitest;

  describe("正常系でのテスト確認", () => {
    test("オプション未指定時に正しくB単位でフォーマットされる", () => {
      expect(formatByteValue(1024)).toBe("1024 B");
    });

    test("KB単位でフォーマットされる", () => {
      expect(formatByteValue(1024, { unit: "KB" })).toBe("1.00 KB");
    });

    test("MB単位でフォーマットされる", () => {
      expect(formatByteValue(1024 * 1024, { unit: "MB" })).toBe("1.00 MB");
    });

    test("GB単位でフォーマットされる", () => {
      expect(formatByteValue(1024 * 1024 * 1024, { unit: "GB" })).toBe(
        "1.00 GB",
      );
    });

    test("TB単位でフォーマットされる", () => {
      expect(formatByteValue(1024 * 1024 * 1024 * 1024, { unit: "TB" })).toBe(
        "1.00 TB",
      );
    });
  });

  describe("境界値チェック", () => {
    test("0.99KBのテスト", () => {
      // 1019Bは0.995KB, 1018Bは0.994KBでtoFixedで四捨五入されると0.99KBになる
      expect(formatByteValue(1018, { unit: "KB" })).toBe("0.99 KB");
    });
  });

  describe("異常系でのテスト確認", () => {
    test("不正な単位指定時にB単位でフォーマットされる", () => {
      // @ts-expect-error - エラーが発生することを確認
      expect(formatByteValue(1024, { unit: "PB" })).toBe("1024 B");
    });

    test("負のB数が含まれた際に0Bで表示される", () => {
      expect(formatByteValue(-1024)).toBe("0 B");
    });
  });
}
