import vue from '@vitejs/plugin-vue';
import { spawn, ChildProcess } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

// Auto-start sidecar server in dev mode
function sidecarPlugin (): Plugin {
   let sidecar: ChildProcess | null = null;
   return {
      name: 'sidecar-auto-start',
      configureServer () {
         sidecar = spawn('npx', ['tsx', 'src/main/server.ts', '--port', '5555'], {
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: path.resolve(__dirname)
         });
         sidecar.stdout?.on('data', (data: Buffer) => {
            const msg = data.toString().trim();
            if (msg) console.log(`[sidecar] ${msg}`);
         });
         sidecar.stderr?.on('data', (data: Buffer) => {
            const msg = data.toString().trim();
            if (msg) console.error(`[sidecar] ${msg}`);
         });
         sidecar.on('exit', (code) => {
            if (code !== null && code !== 0) console.error(`[sidecar] exited with code ${code}`);
         });
      },
      closeBundle () {
         sidecar?.kill();
      }
   };
}

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const contributorsRc = JSON.parse(readFileSync('./.all-contributorsrc', 'utf-8'));
const parsedContributors = contributorsRc.contributors
   .map((c: { name: string }) => c.name)
   .join(',');

export default defineConfig({
   plugins: [vue(), sidecarPlugin()],
   resolve: {
      alias: {
         '@': path.resolve(__dirname, 'src/renderer'),
         'common': path.resolve(__dirname, 'src/common'),
         '~spectre.css': path.resolve(__dirname, 'node_modules/spectre.css'),
         '~': path.resolve(__dirname, 'node_modules')
      }
   },
   define: {
      global: 'globalThis',
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_I18N_LEGACY_API__: true,
      __VUE_I18N_FULL_INSTALL__: true,
      __INTLIFY_PROD_DEVTOOLS__: false,
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
      'import.meta.env.VITE_APP_CONTRIBUTORS': JSON.stringify(parsedContributors)
   },
   css: {
      preprocessorOptions: {
         scss: {
            silenceDeprecations: ['legacy-js-api', 'import', 'global-builtin'],
            additionalData: `@import "@/scss/_variables.scss";`
         }
      }
   },
   server: {
      port: 5173,
      strictPort: true
   },
   build: {
      outDir: 'dist',
      target: 'esnext'
   }
});
