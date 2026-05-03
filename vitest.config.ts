import path from 'node:path';
import { fileURLToPath } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
   plugins: [vue()],
   resolve: {
      alias: {
         '@': path.resolve(__dirname, 'web/renderer'),
         common: path.resolve(__dirname, 'web/common'),
         '@tests': path.resolve(__dirname, 'tests')
      }
   },
   define: {
      __VUE_OPTIONS_API__: true,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_I18N_LEGACY_API__: false,
      __VUE_I18N_FULL_INSTALL__: false,
      __INTLIFY_PROD_DEVTOOLS__: false,
      'import.meta.env.VITE_APP_VERSION': JSON.stringify('test'),
      'import.meta.env.VITE_APP_CONTRIBUTORS': JSON.stringify('')
   },
   test: {
      environment: 'happy-dom',
      globals: true,
      include: ['web/**/*.test.ts', 'tests/**/*.test.ts'],
      setupFiles: ['tests/setup.ts'],
      coverage: {
         provider: 'v8',
         reporter: ['text', 'html', 'lcov', 'json-summary'],
         reportsDirectory: 'coverage',
         include: ['web/**/*.{ts,vue}'],
         exclude: [
            'web/**/*.test.ts',
            'web/**/*.d.ts',
            'web/renderer/scss/**',
            'web/renderer/images/**',
            'web/renderer/untyped.d.ts',
            'web/renderer/components/TheSpecSnapInspector.vue',
            'web/main/**',
            'web/renderer/libs/ext-language_tools.js',
            'tests/.generated/**',
            'e2e/**',
            'src-tauri/**',
            'sidecar/**',
            'workers/**',
            'scripts/**',
            'docs/**'
         ],
         thresholds: {
            lines: 60,
            branches: 60,
            functions: 60,
            statements: 60
         }
      }
   }
});
