import { builtinModules } from "node:module";
import type { AddressInfo } from "node:net";
import type { ConfigEnv, Plugin, UserConfig } from "vite";
import pkg from "./package.json";

export const builtins = [
  "electron",
  ...builtinModules.map((m) => [m, `node:${m}`]).flat(),
];

export const external = [
  ...builtins,
  ...Object.keys(
    "dependencies" in pkg ? (pkg.dependencies as Record<string, unknown>) : {},
  ),
];

export function getBuildConfig(env: ConfigEnv<"build">): UserConfig {
  const { root, mode, command } = env;

  return {
    root,
    mode,
    build: {
      // Prevent multiple builds from interfering with each other.
      emptyOutDir: false,
      // 🚧 Multiple builds may conflict.
      outDir: ".vite/build",
      watch: command === "serve" ? {} : null,
      minify: command === "build",
    },
    clearScreen: false,
  };
}

export function getDefineKeys(
  names: string[],
): Record<string, VitePluginRuntimeKeys> {
  const define: Record<string, VitePluginRuntimeKeys> = {};

  return names.reduce((acc, name) => {
    const NAME = name.toUpperCase();
    const keys: VitePluginRuntimeKeys = {
      VITE_DEV_SERVER_URL: `${NAME}_VITE_DEV_SERVER_URL`,
      VITE_NAME: `${NAME}_VITE_NAME`,
    };

    return { ...acc, [name]: keys };
  }, define);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Define runtime keys.
export function getBuildDefine(env: ConfigEnv<"build">): Record<string, any> {
  const { command, forgeConfig } = env;
  const names = forgeConfig.renderer
    .map((config) => config.name)
    .filter((v): v is NonNullable<typeof v> => !!v);
  const defineKeys = getDefineKeys(names);
  const define = Object.entries(defineKeys).reduce(
    (acc, [name, keys]) => {
      const { VITE_DEV_SERVER_URL, VITE_NAME } = keys;
      const def = {
        [VITE_DEV_SERVER_URL]:
          command === "serve"
            ? JSON.stringify(process.env[VITE_DEV_SERVER_URL])
            : undefined,
        [VITE_NAME]: JSON.stringify(name),
      };
      return { ...acc, ...def };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Define runtime keys.
    {} as Record<string, any>,
  );

  return define;
}

export function pluginExposeRenderer(name: string): Plugin {
  const { VITE_DEV_SERVER_URL } = getDefineKeys([name])[name];

  return {
    name: "@electron-forge/plugin-vite:expose-renderer",
    configureServer(server): void {
      process.viteDevServers ??= {};
      // Expose server for preload scripts hot reload.
      process.viteDevServers[name] = server;

      server.httpServer?.once("listening", () => {
        const addressInfo = server.httpServer?.address() as AddressInfo;
        // Expose env constant for main process use.
        process.env[VITE_DEV_SERVER_URL] =
          `http://localhost:${addressInfo?.port}`;
      });
    },
  };
}

export function pluginHotRestart(command: "reload" | "restart"): Plugin {
  return {
    name: "@electron-forge/plugin-vite:hot-restart",
    closeBundle(): void {
      if (command === "reload") {
        for (const server of Object.values(process.viteDevServers)) {
          // Preload scripts hot reload.
          server.ws.send({ type: "full-reload" });
        }
      } else {
        // Main process hot restart.
        // https://github.com/electron/forge/blob/v7.2.0/packages/api/core/src/api/start.ts#L216-L223
        process.stdin.emit("data", "rs");
      }
    },
  };
}
