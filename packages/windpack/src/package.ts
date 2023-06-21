import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

interface PackageData {
  dir: URL,
  data: {
    [field: string]: any
    name: string
    type: string
    version: string
    main: string
    module: string
    browser: string | Record<string, string | false>
    exports: string | Record<string, any> | string[]
    imports: Record<string, any>
    dependencies: Record<string, string>
  }
}

function readPackageJson(packageJsonPath: string | URL): PackageData {
  const data = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const dir = new URL('.', packageJsonPath);
  return {
    dir,
    data
  };
}

function findNearestPackageJson(path: string | URL) {
  path = typeof path === "string" ? pathToFileURL(path) : path;
  while(path.pathname !== '/') {
    const packageJsonPath = new URL('./package.json', path);
    if (existsSync(packageJsonPath)) {
      return packageJsonPath;
    }
    path = new URL('..', path);
  }

  return null;
}

export function readNearestPackageJson(path: string | URL) {
  const packageJsonPath = findNearestPackageJson(path);
  if (!packageJsonPath) return null;
  return readPackageJson(packageJsonPath);
}

