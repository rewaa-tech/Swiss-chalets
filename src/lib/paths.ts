import { join } from "node:path";
export const dataDir = () => process.env.DATA_DIR || join(process.cwd(), "data");
export const mediaDir = () => join(dataDir(), "media");
export const proofsDir = () => join(dataDir(), "proofs");
