import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const contributorsRc = JSON.parse(readFileSync('./.all-contributorsrc', 'utf-8'));
const parsedContributors = contributorsRc.contributors
   .map((c: { name: string }) => c.name)
   .join(',');

export default defineConfig({
   plugins: [vue()],
   resolve: {
      alias: {
         '@': path.resolve(__dirname, 'src/renderer'),
         'common': path.resolve(__dirname, 'src/common'),
         '~spectre.css': path.resolve(__dirname, 'node_modules/spectre.css'),
         '~': path.resolve(__dirname, 'node_modules')
      }
   },
   define: {
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
