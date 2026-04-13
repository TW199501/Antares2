const fs = require('fs/promises');
const path = require('path');

const ROOT = path.resolve('src/renderer');
const FILE_EXTS = new Set(['.ts', '.js', '.vue']);

const forbiddenPatterns = [
   { name: 'window.open', regex: /window\.open\(/g },
   { name: 'electron import', regex: /from\s+["']electron["']/g },
   { name: '@electron/remote import', regex: /@electron\/remote/g },
   { name: 'tauri migration stub', regex: /Stub\s+.*Tauri migration/gi },
   { name: 'tauri replacement TODO', regex: /TODO:\s*Replace with @tauri-apps\//g }
];

async function walk (dir) {
   const entries = await fs.readdir(dir, { withFileTypes: true });
   const results = [];

   for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
         results.push(...await walk(fullPath));
         continue;
      }

      if (!FILE_EXTS.has(path.extname(entry.name)))
         continue;

      results.push(fullPath);
   }

   return results;
}

function snippetAt (content, index) {
   const start = Math.max(0, index - 20);
   const end = Math.min(content.length, index + 60);
   return content.slice(start, end).replace(/\s+/g, ' ').trim();
}

async function run () {
   const files = await walk(ROOT);
   const violations = [];

   for (const file of files) {
      const content = await fs.readFile(file, 'utf8');

      for (const pattern of forbiddenPatterns) {
         pattern.regex.lastIndex = 0;
         const match = pattern.regex.exec(content);
         if (!match)
            continue;

         violations.push({
            file: path.relative(process.cwd(), file).replaceAll('\\', '/'),
            pattern: pattern.name,
            sample: snippetAt(content, match.index)
         });
      }
   }

   if (!violations.length) {
      console.log('[verify:tauri-migration] PASS');
      return;
   }

   console.error('[verify:tauri-migration] FAIL');
   for (const violation of violations)
      console.error(`- ${violation.file} | ${violation.pattern} | ${violation.sample}`);

   process.exitCode = 1;
}

run().catch((err) => {
   console.error('[verify:tauri-migration] ERROR', err);
   process.exit(1);
});
