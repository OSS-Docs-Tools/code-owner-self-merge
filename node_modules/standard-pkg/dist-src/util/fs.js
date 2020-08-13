import { promisify } from 'util';
// import * as os from 'os';
import * as fs from 'fs';
import _glob from 'glob';
import * as util from 'util';
// import map from './map';
export const glob = promisify(_glob);
// export const open = util.promisify(fs.open);
// export const writeFile = util.promisify(fs.writeFile);
// export const readlink = util.promisify(fs.readlink);
// export const realpath = util.promisify(fs.realpath);
// export const readdir = util.promisify(fs.readdir);
// export const rename = util.promisify(fs.rename);
// export const access = util.promisify(fs.access);
// export const stat = util.promisify(fs.stat);
// export const exists = util.promisify(fs.exists);
// export const lstat = util.promisify(fs.lstat);
// export const chmod = util.promisify(fs.chmod);
// export const link = util.promisify(fs.link);
// export const existsSync = fs.existsSync;
// const readFileBuffer = util.promisify(fs.readFile);
export const readFile = (path) => {
    return util.promisify(fs.readFile)(path, { encoding: 'utf-8' });
};
// import stripBOM from 'strip-bom';
// export async function readJson(loc: string): Promise<Object> {
//   return (await readJsonAndFile(loc)).object;
// }
// export async function readJsonAndFile(
//   loc: string,
// ): Promise<{
//   object: Object,
//   content: string,
// }> {
//   const file = await readFile(loc);
//   try {
//     return {
//       object: map(JSON.parse(stripBOM(file))),
//       content: file,
//     };
//   } catch (err) {
//     err.message = `${loc}: ${err.message}`;
//     throw err;
//   }
// }
// const cr = '\r'.charCodeAt(0);
// const lf = '\n'.charCodeAt(0);
// async function getEolFromFile(path: string): Promise<string | void> {
//   if (!await exists(path)) {
//     return undefined;
//   }
//   const buffer = await readFileBuffer(path);
//   for (let i = 0; i < buffer.length; ++i) {
//     if (buffer[i] === cr) {
//       return '\r\n';
//     }
//     if (buffer[i] === lf) {
//       return '\n';
//     }
//   }
//   return undefined;
// }
// export async function writeFilePreservingEol(path: string, data: string): Promise<void> {
//   const eol = (await getEolFromFile(path)) || os.EOL;
//   if (eol !== '\n') {
//     data = data.replace(/\n/g, eol);
//   }
//   await writeFile(path, data);
// }
