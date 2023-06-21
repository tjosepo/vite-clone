import { defineConfig } from "@tjosepo/windpack";
import react from "@windpack/react-plugin";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
  },
  webpackConfig: {
    entry: "./src/index.tsx",
  },
});
