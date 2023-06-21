import { pathToFileURL } from "node:url";
import { cwd } from 'node:process';

export const cwdURL = () =>  new URL(pathToFileURL(cwd() + "/"));