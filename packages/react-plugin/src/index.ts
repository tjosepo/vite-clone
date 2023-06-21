import ReactRefreshWebpackPlugin from "@pmmmwh/react-refresh-webpack-plugin";
import type { Plugin } from "@tjosepo/windpack";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export default function react(): Plugin {
  return {
    name: "windpack-react",
    config: (_, {mode}) => {
  console.log("heheh here is a plugin");
    
      return {
      devServer: {
      },
      webpackConfig: {
        plugins: [
          mode === "development" && new ReactRefreshWebpackPlugin({ exclude: /node_modules/ }),
        ],
        module: {
          rules: [
            {
              assert: { type: "jsx" },
              use: require.resolve("@svgr/webpack"),
            }
          ]
        }
      }
    }}
  }
}