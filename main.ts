// Driver entri csv-reader-speed-01: harness menjalankan `node /bot/main.ts`
// (Node 22). Membaca /input/cases.json, menjawab tiap case sendiri-sendiri
// dengan run() dari solve.js, lalu menulis /output/answers.json: satu
// jawaban per case, urutan sama dengan cases.json. Di luar container,
// MAKEFUN_INPUT_DIR dan MAKEFUN_OUTPUT_DIR menggantikan /input dan /output.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setFlagsFromString } from "node:v8";

// Incremental marking V8 dimatikan sebelum solve.js diimpor, seperti
// baseline house — seluruh kerja solve.js berjalan di bawah flag ini.
setFlagsFromString("--no-incremental-marking");

/** solve.js, diimpor lewat URL-nya (modul .js tanpa tipe) sesuai kontraknya. */
const { run } = (await import(new URL("./solve.js", import.meta.url).href)) as {
  run: (input: unknown) => unknown;
};

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

const cases = JSON.parse(readFileSync(join(INPUT_DIR, "cases.json"), "utf8")) as {
  id: string;
  input: unknown;
}[];
const answers: unknown[] = [];
for (const c of cases) answers.push(run(c.input));
writeFileSync(join(OUTPUT_DIR, "answers.json"), JSON.stringify(answers));
