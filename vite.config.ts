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
         'common': path.resolve(__dirname, 'src/common')
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
            additionalData: `@use "@/scss/_variables.scss" as *;`
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
