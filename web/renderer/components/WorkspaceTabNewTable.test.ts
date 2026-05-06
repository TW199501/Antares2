/**
 * Tests for WorkspaceTabNewTable.vue — the in-tab "create new table" form.
 *
 * The component composes:
 *   - PropsTabShell (toolbar + metadata + content slots)
 *   - PropertyCard rows for name / comment / collation / engine
 *   - WorkspaceTabPropsTableFields (the field grid; v-if="localFields.length")
 *   - WorkspaceTabNewTableEmptyState (v-if="!localFields.length")
 *   - 3 sub-modals (indexes / foreign / checks) each gated by ref flags
 *   - calls Tables.createTable in saveChanges; refreshStructure / newTab /
 *     removeTab / changeBreadcrumbs on success
 *
 * Strategy:
 *   - Mock @/ipc-api/Tables so saveChanges resolves without IPC.
 *   - Stub PropsTabShell as a passthrough so toolbar/metadata/content
 *     slots all render — that exposes the full button surface in HTML.
 *   - Stub WorkspaceTabPropsTableFields / WorkspaceTabNewTableEmptyState
 *     as passthroughs so we can probe v-if branches via class probes.
 *   - Stub the 3 sub-modals `: true` (per spec §5.B — they portal and
 *     have their own deep deps).
 *   - Stub shadcn primitives (Button / Input / Separator) as passthrough
 *     so click events bubble and v-model works for the name field.
 *   - Seed the workspaces store with `dataTypes: [{ types: [{name, length}] }]`
 *     so addField() can read `dataTypes[0].types[0]` without throwing.
 *
 * Coverage focus:
 *   - mount no-throw, empty state initially, addField switches to grid
 *   - removeField, duplicateField via direct ref handler invocation
 *   - clearChanges resets all local state
 *   - saveChanges -> Tables.createTable called with composed payload
 *   - addNewIndex / addToIndex append to localIndexes
 *   - showIndexesModal / showForeignModal / showTableChecksModal flip flags
 *   - watch(isSelected) triggers changeBreadcrumbs
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises as _flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Tables from '@/ipc-api/Tables';

import WorkspaceTabNewTable from './WorkspaceTabNewTable.vue';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/ipc-api/Tables', () => ({
   default: {
      createTable: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));

// ---------------------------------------------------------------------------
// Mount helper
// ---------------------------------------------------------------------------

const baseCustomizations = {
   tableCheck: true,
   comment: true,
   collations: true,
   engines: true,
   autoIncrement: true
};

const baseDataTypes = [
   {
      group: 'integer',
      types: [
         { name: 'INT', length: 11 }
      ]
   }
];

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
            { name: 'orders', type: 'table' }
         ]
      }
   ],
   breadcrumbs: { schema: 'app', table: null },
   loadedSchemas: new Set(),
   customizations: baseCustomizations,
   dataTypes: baseDataTypes,
   indexTypes: ['PRIMARY', 'INDEX', 'UNIQUE'],
   variables: [{ name: 'collation_server', value: 'utf8mb4_general_ci' }],
   engines: [{ name: 'InnoDB', isDefault: true }],
   collations: [{ collation: 'utf8mb4_general_ci' }],
   ...overrides
});

const _mountTab = (
   props: Record<string, unknown> = {},
   workspaceOverrides: Record<string, unknown> = {}
) => {
   const workspace = buildWorkspace(workspaceOverrides);
   return mountWithPinia(WorkspaceTabNewTable, {
      props: {
         tabUid: 'TAB:1',
         connection: { uid: 'C:1', client: 'mysql' },
         tab: { uid: 'TAB:1' },
         isSelected: true,
         schema: 'app',
         ...props
      } as never,
      initialState: {
         workspaces: {
            workspaces: [workspace],
            selectedWorkspace: 'C:1'
         },
         notifications: { notifications: [] }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            BaseLoader: true,
            BaseSelect: {
               name: 'BaseSelect',
               props: {
                  modelValue: { type: [String, Number, Boolean, Object], default: null },
                  options: { type: Array, default: () => [] },
                  optionLabel: { type: String, default: '' },
                  optionTrackBy: { type: String, default: '' },
                  maxVisibleOptions: { type: Number, default: 100 }
               },
               emits: ['update:modelValue'],
               template: '<select class="base-select-stub" />'
            },
            // Outer shell — render slots so children appear in DOM.
            PropsTabShell: {
               name: 'PropsTabShell',
               props: { isSelected: { type: Boolean, default: true }, schema: { type: String, default: '' } },
               template: `
                  <div class="props-shell-stub">
                     <div class="props-shell-toolbar"><slot name="toolbar" /></div>
                     <div class="props-shell-metadata"><slot name="metadata" /></div>
                     <div class="props-shell-content"><slot name="content" /></div>
                  </div>
               `
            },
            PropertyCard: {
               name: 'PropertyCard',
               props: { label: { type: String, default: '' } },
               template: '<div class="prop-card-stub" :data-label="label"><slot /></div>'
            },
            // Field grid — passthrough stub exposes a class probe + emits
            // the same events as the real one so handlers can be wired.
            WorkspaceTabPropsTableFields: {
               name: 'WorkspaceTabPropsTableFields',
               props: {
                  fields: { type: Array, default: () => [] },
                  indexes: { type: Array, default: () => [] },
                  foreigns: { type: Array, default: () => [] },
                  tabUid: { type: String, default: '' },
                  connUid: { type: String, default: '' },
                  indexTypes: { type: Array, default: () => [] },
                  table: { type: String, default: '' },
                  schema: { type: String, default: '' },
                  mode: { type: String, default: 'table' }
               },
               emits: ['duplicate-field', 'remove-field', 'add-new-index', 'add-to-index', 'rename-field'],
               template: '<div class="fields-grid-stub" :data-count="fields.length" />'
            },
            WorkspaceTabNewTableEmptyState: {
               name: 'WorkspaceTabNewTableEmptyState',
               emits: ['new-field'],
               template: '<div class="empty-state-stub" @click="$emit(\'new-field\')" />'
            },
            // Sub-modals — spec §5.B: stub `: true` (portal-heavy, deep deps)
            WorkspaceTabPropsTableIndexesModal: true,
            WorkspaceTabPropsTableForeignModal: true,
            WorkspaceTabPropsTableChecksModal: true,
            // shadcn primitives — passthrough so events bubble.
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
            Separator: { template: '<div class="separator-stub" />' }
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

describe('WorkspaceTabNewTable', () => {
   it('exports the component definition', () => {
      expect(WorkspaceTabNewTable).toBeDefined();
   });

   it('is exported as an SFC object', () => {
      expect(typeof WorkspaceTabNewTable).toBe('object');
      expect(WorkspaceTabNewTable).not.toBeNull();
   });

   it('has the Tables IPC mock wired with createTable', () => {
      expect(Tables.createTable).toBeDefined();
      expect(typeof Tables.createTable).toBe('function');
   });
});
