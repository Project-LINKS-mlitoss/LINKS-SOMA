/// <reference types="vitest" />
import { defineConfig } from "vite";

// eslint-disable-next-line import-x/no-default-export -- vite config
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    includeSource: ["src/**/*.ts"],
  },
});
