import { join } from "node:path";
import { cwd } from "node:process";
import { AnyZodObject, ZodError, z } from "zod";
import swc, { Config } from "@swc/core";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { Configuration } from "webpack";
import pc from "picocolors";
import * as esbuild from "esbuild";
import { createRequire } from "node:module";
import { resolve as importMetaResolve} from 'import-meta-resolve'

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
  let message = "Invalid windpack config:\n";
  for (const err of error.errors) {
    message += `  - ${pc.cyan(err.path.join("."))}: ${err.message}\n`;
  }
  console.error(message);
  process.exit(1);
}

export async function findDefaultConfig(): Promise<string | undefined> {
  const defaultName = "windpack.config";
  const extensions = [".ts", ".js"];

  for (const ext of extensions) {
    const filename = defaultName + ext;
    const filepath = join(cwd(), filename);
    if (existsSync(filepath)) {
      return filepath;
    }
  }

  return undefined;
}

export async function readUserConfigFile(sourcefile: string) {
  const outdir = join(cwd(), "node_modules", ".windpack");
  const outfile = join(outdir, "config.mjs");

  await esbuild.build({
    entryPoints: [sourcefile],
    outfile,
    bundle: true,
    format: "esm",
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
  // const output = await swc.transform(source, {
  //   sourceFileName: sourcefile,
  //   jsc: {
  //     parser: {
  //       syntax: "typescript",
  //       tsx: false,
  //     },
  //   },
  // });
  // await mkdir(outdir, { recursive: true });
  // await writeFile(outfile, output.code, { flag: "w" });
  const module = await import(pathToFileURL(outfile).toString());
  const maybeConfig = module.default as unknown;
  validateConfig(maybeConfig);
  return maybeConfig;
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
