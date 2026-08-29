#!/usr/bin/env node
// Unpack assets/content.zip -> assets/content/** (the user's dataset pack).
// The zip is what's tracked in git; the extracted .txt files are what Metro
// bundles as assets. Run automatically by export-web.sh when missing.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';

const ZIP = 'assets/content.zip';
const OUT = 'assets/content';

if (!existsSync(ZIP)) {
  console.error(`unpack-content: ${ZIP} not found — it must be tracked in git.`);
  process.exit(1);
}

// use python zipfile for portability (unzip chokes on some of these entries)
const script = `
import zipfile, os, sys
z = zipfile.ZipFile(${JSON.stringify(ZIP)})
n = 0
for info in z.infolist():
    name = info.filename.replace('\\\\', '/')
    if name.endswith('/') or '__MACOSX' in name:
        continue
    dest = os.path.join(${JSON.stringify(OUT)}, name)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, 'wb') as f:
        f.write(z.read(info))
    n += 1
print(n)
`;
const n = execSync(`python3 - <<'PY'\n${script}\nPY`).toString().trim();
console.log(`unpack-content: ${n} files extracted to ${OUT}/`);
