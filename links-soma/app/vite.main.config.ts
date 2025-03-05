import type { ConfigEnv, UserConfig } from "vite";
import { defineConfig, mergeConfig } from "vite";
import native from "vite-plugin-native";
import {
  getBuildConfig,
  getBuildDefine,
  external,
  pluginHotRestart,
} from "./vite.base.config";

// https://vitejs.dev/config
export default defineConfig((env) => {
  const forgeEnv = env as ConfigEnv<"build">;
  const { forgeConfigSelf } = forgeEnv;
  const define = getBuildDefine(forgeEnv);
  const config: UserConfig = {
    build: {
      lib: {
        entry: forgeConfigSelf.entry || "",
        fileName: () => "[name].js",
        formats: ["cjs"],
      },
      rollupOptions: {
        external,
      },
    },

    plugins: [
      pluginHotRestart("restart"),
      // Load C/C++ native modules. Like sqlite3, better-sqlite3, fsevents etc.
      native({ webpack: {} }),
    ],
    define,
    resolve: {
      // Load the Node.js entry.
      mainFields: ["module", "jsnext:main", "jsnext"],
    },
  };

  return mergeConfig(getBuildConfig(forgeEnv), config);
});
