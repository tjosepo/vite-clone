import { join } from "node:path";
import { cwd } from "node:process";
import { ZodError, z } from "zod";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Configuration } from "webpack";
import pc from "picocolors";
import * as esbuild from "esbuild";
import { createRequire } from "node:module";
import { resolve as importMetaResolve} from 'import-meta-resolve'
import { readNearestPackageJson } from "./package.js";
import { cwdURL } from "./utils.js";
import { setState } from "./console/counter.js";

export const resolve = (path: string, base: string = cwd()) => join(base, path);

export interface Plugin {
  name: string;
  config?(
    config: UserConfig,
    options: { mode: "development" | "production" }
  ): UserConfig | void;
}

const ConfigSchema = z.object({
  plugins: z.array(z.custom<Plugin>()).default([]),
  appType: z.enum(["spa", "custom"]).default("spa"),
  root: z.string().default(cwd()),
  base: z.string().default("/"),
  mode: z.enum(["development", "production"]).default("development"),
  cacheDir: z.string().default("node_modules/.cache/windpack"),
  define: z.record(z.any()).default({}),
  publicDir: z.string().default("public"),
  clearScreen: z.boolean().default(true),
  resolve: z
    .object({
      extensions: z
        .array(z.string())
        .default([".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx"]),
      preserveSymlinks: z.boolean().default(true),
    })
    .default({}),
  server: z
    .object({
      port: z.number().default(3000),
      base: z.string().default("/"),
    })
    .default({}),
  webpackConfig: z.custom<Configuration>().default({}),
  swc: z
    .object({
      include: z
        .union([z.string(), z.instanceof(RegExp)])
        .default(/\.(ts|jsx|tsx)$/),
      exclude: z
        .union([z.string(), z.instanceof(RegExp)])
        .default(/node_modules/),
    })
    .default({}),
});

export type WindpackConfig = z.infer<typeof ConfigSchema>;

export type UserConfig = z.input<typeof ConfigSchema>;

export function defineConfig(config: UserConfig) {
  return config;
}

export function parseConfig(config: unknown): WindpackConfig {
  const result = ConfigSchema.safeParse(config);
  if (!result.success) {
    printConfigError(result.error);
  }
  return ConfigSchema.parse(config);
}

export function validateConfig(config: unknown): asserts config is UserConfig {
  try {
    ConfigSchema.parse(config);
  } catch (e: any) {
    printConfigError(e);
  }
}

function printConfigError(error: ZodError<UserConfig>) {
  setState(state => ({ ...state, state: "clear"}));
  let message = "Invalid configuration:\n";
  message += error.errors.map(err => (
    `  - ${pc.cyan(err.path.join("."))}: ${err.message}`
  )).join("\n");
  console.error(message);
  process.exit(1);
}

export async function findDefaultConfig() {
  const extensions = [".ts", ".js", ".mts", ".mjs", ".cts", ".cjs"];
  const dir = cwdURL();
  for (const ext of extensions) {
    const filepath = new URL("./windpack.config" + ext, dir);
    if (existsSync(filepath)) {
      return filepath;
    }
  }

  return undefined;
}

export async function readUserConfigFile(sourcefile: string | URL) {
  const file = fileURLToPath(sourcefile);

  let isESM = false;
  if (file.endsWith(".mjs") || file.endsWith(".mts")) {
    isESM = true;
  } else if (file.endsWith(".cjs") || file.endsWith(".cts")) {
    isESM = false;
  } else {
    const packageData = readNearestPackageJson(file);
    if (packageData) {
      isESM = packageData.data.type === "module";
    }
  }

  const result = await esbuild.build({
    entryPoints: [file],
    bundle: true,
    write: false,
    format: isESM ? "esm" : "cjs",
    platform: "node",
    target: "node16",
    sourcemap: "inline",
    plugins: [
      {
        name: "windpack:externalize-deps",
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            if (args.kind === "entry-point") {
              return;
            }

            
            if (args.kind === "require-call") {
              const resolved = createRequire(args.importer).resolve(args.path);
              return {
                path: resolved,
                external: true,
              };
            }

            if (args.kind === "import-statement") {
                if (args.path.startsWith(".") || args.path.startsWith("/")) {
                  return;
                }

                const resolved = importMetaResolve(args.path, pathToFileURL(args.importer).href);
                return {
                  path: resolved,
                  external: true,
                }
            }

            return {
              path: args.path,
              external: true,
            };
          });
        },
      },
    ],
  });

  const text = result.outputFiles![0].text;
  let config: unknown = null;
  if (isESM) {
    try {
      // Postfix the bundled code with a timestamp to avoid Node's ESM loader cache
      const configTimestamp = `timestamp:${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`

      const mod = await import(`data:text/javascript;base64,${Buffer.from(`${text}\n//${configTimestamp}`).toString('base64')}`);
      config = mod.default
    } catch (e) {
      if (e instanceof Error) {
        throw new Error(`${e.message} at ${sourcefile}`);
      }
      throw e;
    }
  } else {
    setState(state => ({ ...state, state: "clear"}));
    console.log("CommonJS configuration is not supported. You can either:\n"
    + `  - Use a ESM config file (e.g. ${pc.cyan("windpack.config.mts")})\n`
    + `  - Change your package.json type to ${pc.cyan('"module"')}`);
    process.exit(1);
  }

  validateConfig(config);
  return config;
}

export function arraify<T>(target: T | T[]): T[] {
  return Array.isArray(target) ? target : [target];
}

function mergeConfigRecursively(
  defaults: Record<string, any>,
  overrides: Record<string, any>,
  rootPath: string
) {
  const merged: Record<string, any> = { ...defaults };
  for (const key in overrides) {
    const value = overrides[key];
    if (value == null) {
      continue;
    }

    const existing = merged[key];

    if (existing == null) {
      merged[key] = value;
      continue;
    }

    if (Array.isArray(existing) || Array.isArray(value)) {
      merged[key] = [...arraify(existing ?? []), ...arraify(value ?? [])];
      continue;
    }
    if (typeof existing === "object" && typeof value === "object") {
      merged[key] = mergeConfigRecursively(
        existing,
        value,
        rootPath ? `${rootPath}.${key}` : key
      );
      continue;
    }

    merged[key] = value;
  }
  return merged;
}

export function mergeConfig<
  D extends Record<string, any>,
  O extends Record<string, any>
>(
  defaults: D extends Function ? never : D,
  overrides: O extends Function ? never : O,
  isRoot = true
): Record<string, any> {
  if (typeof defaults === "function" || typeof overrides === "function") {
    throw new Error(`Cannot merge config in form of callback`);
  }

  return mergeConfigRecursively(defaults, overrides, isRoot ? "" : ".");
}
