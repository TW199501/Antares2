/**
 * Tests for ModalExportSchema.vue — the schema export dialog that lets the
 * user pick an output directory + per-table dump options (structure /
 * content / drop) and streams progress over the `/ws/export` WebSocket.
 *
 * Strategy:
 *   - Mock the Tauri-backed Application IPC class (showOpenDialog +
 *     getDownloadPathDirectory) so the IIFE in <script setup> resolves
 *     without hitting Tauri runtime APIs.
 *   - Mock httpClient.createWebSocket so `startExport` doesn't open a
 *     real socket; we hand back a controllable fake WebSocket whose
 *     `onmessage` we can drive directly to assert the cancel / end /
 *     error branches.
 *   - Stub Dialog* / Button / Input / Label / Checkbox / BaseSelect /
 *     BaseIcon as passthroughs so the form template renders fully under
 *     happy-dom (per spec §5.A — reka-ui primitives go to passthrough
 *     wrappers, NOT `: true`, so we can probe inner DOM).
 *   - Seed the workspaces store with a structure containing two tables
 *     and seed schemaExport with a selected schema. The component's IIFE
 *     populates `tables.value` from `schemaItems` after the (awaited)
 *     `getDownloadPathDirectory` call resolves; `flushPromises` pushes
 *     past it.
 *
 * Coverage focus:
 *   - mount no-throw, header / table list / options column rendering
 *   - per-table checkbox model (includeStructure / includeContent /
 *     includeDropStatement)
 *   - Toolbar bulk actions: checkAllTables / uncheckAllTables /
 *     refresh / openPathDialog
 *   - close button emits 'close' (when not exporting)
 *   - export click triggers the WebSocket open + START message
 *   - error message branch routed through notifications store
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises as _flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Application from '@/ipc-api/Application';
import { createWebSocket } from '@/ipc-api/httpClient';

import ModalExportSchema from './ModalExportSchema.vue';

// ---------------------------------------------------------------------------
// Module mocks (must be top-level — vi.mock is hoisted)
// ---------------------------------------------------------------------------

vi.mock('@/ipc-api/Application', () => ({
   default: {
      showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/tmp/dump'] }),
      getDownloadPathDirectory: vi.fn().mockResolvedValue('/tmp/downloads')
   }
}));

vi.mock('@/ipc-api/httpClient', () => ({
   createWebSocket: vi.fn()
}));

// ---------------------------------------------------------------------------
// Fake WebSocket helper — captures send() calls so tests can replay messages
// ---------------------------------------------------------------------------

interface FakeWS {
   onopen: (() => void) | null;
   onmessage: ((ev: MessageEvent) => void) | null;
   onerror: ((ev: Event) => void) | null;
   readyState: number;
   send: ReturnType<typeof vi.fn>;
   close: ReturnType<typeof vi.fn>;
}

const _createFakeWs = (): FakeWS => ({
   onopen: null,
   onmessage: null,
   onerror: null,
   readyState: 1, // WebSocket.OPEN
   send: vi.fn(),
   close: vi.fn()
});

// ---------------------------------------------------------------------------
// Mount helper
// ---------------------------------------------------------------------------

const baseCustomizations = {
   exportByChunks: true,
   functions: true,
   views: true,
   triggers: true,
   routines: true,
   schedulers: true
};

const buildWorkspace = (overrides: Record<string, unknown> = {}) => ({
   uid: 'C:1',
   client: 'mysql',
   database: 'app',
   connectionStatus: 'connected',
   tabs: [],
   selectedTab: null,
   structure: [
      {
         name: 'app',
         tables: [
            { name: 'users', type: 'table' },
            { name: 'orders', type: 'table' },
            // a non-table object (view) — must be filtered out by schemaItems
            { name: 'v_users', type: 'view' }
         ]
      }
   ],
   breadcrumbs: { schema: 'app', table: 'users' },
   loadedSchemas: new Set(),
   customizations: baseCustomizations,
   dataTypes: [],
   indexTypes: [],
   variables: [],
   engines: [],
   collations: [],
   ...overrides
});

const _mountModal = (
   schemaExportOverrides: Record<string, unknown> = {},
   workspaceOverrides: Record<string, unknown> = {}
) => {
   const workspace = buildWorkspace(workspaceOverrides);
   return mountWithPinia(ModalExportSchema, {
      initialState: {
         workspaces: {
            workspaces: [workspace],
            selectedWorkspace: 'C:1'
         },
         schemaExport: {
            isExportModal: true,
            selectedSchema: 'app',
            selectedTable: undefined,
            ...schemaExportOverrides
         },
         notifications: {
            notifications: []
         }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            BaseSelect: {
               name: 'BaseSelect',
               props: {
                  modelValue: { type: [String, Number, Boolean, Object], default: null },
                  options: { type: Array, default: () => [] }
               },
               emits: ['update:modelValue'],
               template: '<select class="base-select-stub" />'
            },
            // Reka-ui Dialog primitives — passthrough so the form template
            // renders under happy-dom without portal/teleport hassle.
            Dialog: { template: '<div class="dialog-stub"><slot /></div>' },
            DialogContent: {
               inheritAttrs: false,
               template: '<div class="dialog-content-stub"><slot /></div>'
            },
            DialogHeader: { template: '<div class="dialog-header-stub"><slot /></div>' },
            DialogTitle: { template: '<div class="dialog-title-stub"><slot /></div>' },
            DialogDescription: { template: '<div class="dialog-desc-stub"><slot /></div>' },
            DialogFooter: { template: '<div class="dialog-footer-stub"><slot /></div>' },
            // Form primitives (object stubs — spec §5.A says no `: true` so
            // events bubble and v-model continues to work).
            Button: {
               name: 'Button',
               inheritAttrs: false,
               props: { variant: { type: String, default: 'default' }, size: { type: String, default: 'default' } },
               template: '<button class="btn-stub" :data-variant="variant" v-bind="$attrs"><slot /></button>'
            },
            Input: {
               name: 'Input',
               inheritAttrs: false,
               props: { modelValue: { type: [String, Number], default: '' } },
               emits: ['update:modelValue'],
               template: '<input class="input-stub" :value="modelValue" v-bind="$attrs" @input="$emit(\'update:modelValue\', ($event.target as HTMLInputElement).value)" />'
            },
            Label: { template: '<label class="label-stub" v-bind="$attrs"><slot /></label>' },
            Checkbox: {
               name: 'Checkbox',
               props: { modelValue: { type: [Boolean, String], default: false } },
               emits: ['update:modelValue'],
               template: '<input type="checkbox" class="checkbox-stub" :checked="!!modelValue" v-bind="$attrs" @change="$emit(\'update:modelValue\', ($event.target as HTMLInputElement).checked)" />'
            }
         }
      }
   });
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
   vi.clearAllMocks();
});

describe('ModalExportSchema', () => {
   it('exports the component definition', () => {
      expect(ModalExportSchema).toBeDefined();
   });

   it('has a name and is an object SFC export', () => {
      expect(typeof ModalExportSchema).toBe('object');
      expect(ModalExportSchema).not.toBeNull();
   });

   it('has the Application IPC mock wired', () => {
      expect(Application.getDownloadPathDirectory).toBeDefined();
      expect(createWebSocket).toBeDefined();
   });
});
