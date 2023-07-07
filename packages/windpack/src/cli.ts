import Webpack from "webpack";
import WebpackDevServer from "webpack-dev-server";
import { findDefaultConfig, parseConfig, readUserConfigFile, mergeConfig } from "./config.js";
import { join } from "node:path";
import HtmlWebpackPlugin from "html-webpack-plugin";
import { createRequire } from "node:module";
import counter from "./console/counter.js";
import { setState } from "./console/counter.js";
import { clearErrors, setError } from "./console/Errors.js";
import { debug } from "./console/Debug.js";
import { cwd } from "node:process";
import type { Config as SwcConfig  } from "@swc/core";
import { printCompilationOutput } from "./utils.js";

const require = createRequire(import.meta.url);


let start = performance.now();

const build = process.argv.includes("build");

async function main() {
  let firstBuildDone = false;
  debug("Starting Windpack");

  const configPath = await findDefaultConfig();

  if (!configPath) {
    // logger.error("No config file found");
    return;
  }

  debug("Config file found at", configPath);

  const userConfig = await readUserConfigFile(configPath);

  const plugins = userConfig.plugins || [];

  debug(`Found ${plugins.length} ${plugins.length === 1 ? "plugin" : "plugins"}`)

  // Merge config from plugins
  const mergedConfig = plugins.reduce((config, plugin) => {
    const pluginConfig = plugin.config?.(config, { mode: userConfig.mode || build ? "production" : "development"});
    return pluginConfig ? mergeConfig(config, pluginConfig) : config;
  }, userConfig);

  const config = parseConfig(mergedConfig);

  debug("Configuration read");

  const compiler = Webpack({
    mode: config.mode,
    context: config.root,
    entry: config.webpackConfig?.entry,
    cache: {
      type: "filesystem",
      cacheDirectory: join(cwd(), config.cacheDir),
      store: "pack",
    },
    resolve: {
      extensions: config.resolve.extensions,
      symlinks: config.resolve.preserveSymlinks,
    },
    plugins: [
      config.appType === "spa" && new HtmlWebpackPlugin({
        publicPath: "/",
        template: join(config.publicDir, "index.html"),
      }),
      new Webpack.DefinePlugin({
        "process.env.NODE_ENV": JSON.stringify(config.mode),
        "import.meta.env.MODE": JSON.stringify(config.mode),
        "import.meta.env.BASE_URL": JSON.stringify(config.base),
        "import.meta.env.PROD": config.mode === "production",
        "import.meta.env.DEV": config.mode === "development",
        ...config.define,
      }),
      // new FileListPlugin({
      //   outputFile: 'my-assets.md',
      // }),
      // new SpaWebpackPlugin({
      //   indexHtml: "index.html"
      // }),
      ...(config.webpackConfig.plugins || [])
    ],
    module: {
      rules: [
        {
          test: config.swc.include,
          exclude: config.swc.exclude,
          use: {
            loader: require.resolve("swc-loader"),
            options: {
              jsc: {
                transform: {
                  react: {
                    runtime: "automatic",
                    development: config.mode === "development",
                    refresh: config.mode === "development",
                  },
                },
                experimental: {
                  keepImportAssertions: true
                },
              },
            } satisfies SwcConfig,
          },
        },
        {
          test: /\.css$/i,
          use: [
            require.resolve("style-loader"),
            require.resolve("css-loader"),
            require.resolve("postcss-loader"),
          ],
        },
        {
          assert: { type: "url" },
          type: "asset/resource",
        },
        {
          assert: { type: "raw" },
          type: "asset/source",
        },
        ...config.webpackConfig.module?.rules || [],
      ],
    },
    infrastructureLogging: {
      level: "none",
    },
    stats: "none",
    output: {
      clean: true,
      assetModuleFilename: "assets/[name]-[contenthash][ext]",
      filename: "assets/[name]-[contenthash].js",
      pathinfo: false,
  },
  optimization: {
      moduleIds: 'deterministic',
      runtimeChunk: true,
      removeAvailableModules: false,
      removeEmptyChunks: false,
      splitChunks: {
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        }
      }
  }
  });

  compiler.hooks.watchRun.tap("Windpack", () => {
    if (firstBuildDone) {
      start = performance.now();
    }
  });

  compiler.hooks.done.tap("Windpack", (stats) => {
    const time = (performance.now() - start).toFixed(0);
    firstBuildDone = true;
    setState((state) => ({ ...state, state: "done", time: Number(time) }));
    debug(`Compiled in ${time}ms`);
    if (build) {
      printCompilationOutput(stats);
    }
  });

  const url = `http://localhost:${config.server.port}${
    config.server.base !== "/" ? config.server.base : ""
  }`;

  setState((state) => ({ ...state, url }));

  compiler.hooks.compilation.tap("Windpack", (compilation) => {
    debug("Starting a new compilation...")
    if (build) {
      setState((state) => ({ ...state, state: "building" }));
    } else {
      setState((state) => ({ ...state, state: "compiling" }));
    }
    clearErrors();

    compilation.hooks.processErrors.tap("Windpack", (errors) => {
      setError(...errors.map((error) => error.message));
      return errors;
    });
  });

  debug("Created compiler")

  if (build) {
    return compiler.run((err, stats) => {
      if (err) {
        setError(err.message);
      }
    });
  }

  const server = new WebpackDevServer(
    {
      hot: true,
      port: config.server.port,
      historyApiFallback: config.appType === "spa",
    },
    compiler
  );

  server.startCallback(() => {
    debug("Starting the development server...");
  });

  debug("Created server")
}

counter();
main();

// const worker = new Worker(new URL('./worker.js', import.meta.url));
