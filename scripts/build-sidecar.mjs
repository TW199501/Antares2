import { build } from 'esbuild';

// Packages that use dynamic __dirname-based requires or native addons.
// These are already bundled as resources in tauri.conf.json and must NOT
// be inlined into the CJS bundle — they need to load from node_modules at runtime.
const external = [
   'better-sqlite3',
   'ssh2',
   'cpu-features',
   '@heroku/socksv5',
   '@fabio286/ssh2-promise',
   'bindings',
   'file-uri-to-path',
   'node-firebird',
];

// Build main server
await build({
   entryPoints: ['src/main/server.ts'],
   bundle: true,
   platform: 'node',
   format: 'cjs',
   outfile: 'sidecar/antares-server.cjs',
   external,
   define: { 'import.meta.url': 'undefined' },
   tsconfig: 'tsconfig.json',
   logLevel: 'info',
});

// Build workers as separate files (loaded via new Worker(require.resolve('../workers/...')))
// require.resolve is called from sidecar/__dirname, so '../workers/' = install_dir/workers/
for (const worker of ['exporter', 'importer']) {
   await build({
      entryPoints: [`src/main/workers/${worker}.ts`],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      outfile: `workers/${worker}.js`,
      external,
      define: { 'import.meta.url': 'undefined' },
      tsconfig: 'tsconfig.json',
      logLevel: 'info',
   });
}

console.log('sidecar bundle built → sidecar/antares-server.cjs + workers/');
