import pc from 'picocolors';

const start = performance.now();
const debug = process.argv.includes("--debug");
const printLogo = () => console.log(pc.magenta(pc.bold("Windpack")));

export const time = () => pc.dim((performance.now() - start).toFixed(0) + "ms");

export const logger = {
  log(...data: any[]) {
    console.log(...data);
  },
  info: console.info,
  warn(...data: any[]) {
    return console.warn(...data);
  },
  error: console.error,
  debug(...data: any[]) {
    if (!debug) return;

    console.debug(pc.blue("[DEBUG]"), time(), ...data)
  },
  clear() {
    if (debug) {
      return;
    }
    console.clear();
    printLogo();
  }
} as const;

logger.clear();