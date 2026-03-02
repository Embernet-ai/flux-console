import fs from 'fs';
import fsExtra from 'fs-extra';
import path from 'path';
import {fileURLToPath} from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonRaw = fs.readFileSync("./package.json", 'utf8');
const packageJson = JSON.parse(packageJsonRaw);
const fluxVersion = packageJson.version;

const file = path.resolve(__dirname, 'projects/flux-console-lib/src/lib', 'FLUX_VERSION.ts');
fsExtra.writeFileSync(file,`export const FLUX_VERSION = {
    "version": "${fluxVersion}"
};
`, { encoding: 'utf-8' });
