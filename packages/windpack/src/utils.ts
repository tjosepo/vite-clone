import { pathToFileURL } from "node:url";
import { cwd } from 'node:process';
import type { Stats } from "webpack";
import { relative, resolve } from "node:path";
import pc from "picocolors";

export const cwdURL = () =>  new URL(pathToFileURL(cwd() + "/"));

export function printCompilationOutput(stats: Stats) {
  const outdir = relative(cwd(), stats.compilation.outputOptions.path || "");

  for (const [name, info] of stats.compilation.assetsInfo) {
    const { size } = info;
    const sizeStr = formatBytes(size);
    const pathColor = name.endsWith(".js") ? pc.cyan : name.endsWith(".css") ? pc.magenta : pc.green;
    console.log(pc.dim(outdir + "/") + pathColor(name) + pc.dim(` (${sizeStr})`));
  }
}

function formatBytes(bytes?: number) {
  if (bytes === undefined) {
    return "";
  }

  if (bytes < 1024) return `${bytes} B`;
  
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;

  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;

  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}