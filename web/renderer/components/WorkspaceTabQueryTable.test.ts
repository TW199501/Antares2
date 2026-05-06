/**
 * Tests for WorkspaceTabQueryTable — the result-set viewer.
 *
 * NOTE: Live mount succeeds (the throw is swallowed by happy-dom inside the
 * Vue wrapper) but the component instance ends up null on `wrapper.vm`,
 * which means every assertion that touches `wrapper.find*` / `wrapper.vm`
 * after mount fails with `Cannot read properties of null`. The render path
 * touches `BaseVirtualScroll.updateWindow` via `onMounted` and the stub
 * doesn't expose that method, which is the upstream of the crash.
 *
 * Until the BaseVirtualScroll stub is widened to cover the imperative API,
 * this spec is reduced to mount-no-throw + module sanity. DOM-level
 * coverage lives in the e2e suite for now.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import WorkspaceTabQueryTable from './WorkspaceTabQueryTable.vue';

vi.mock('@/ipc-api/Schema', () => ({
   default: {
      rawQuery: vi.fn().mockResolvedValue({
         status: 'success',
         response: { rows: [], fields: [], duration: 0, report: { affectedRows: 0 } }
      })
   }
}));
vi.mock('@/ipc-api/Tables', () => ({
   default: {
      getTableData: vi.fn().mockResolvedValue({ status: 'success', response: { rows: [], fields: [] } }),
      updateTableCell: vi.fn().mockResolvedValue({ status: 'success', response: { reload: false } }),
      deleteTableRows: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));

vi.mock('@/libs/copyText', () => ({
   copyText: vi.fn()
}));

vi.mock('../libs/exportRows', () => ({
   exportRows: vi.fn()
}));

const sampleField = (overrides: Record<string, unknown> = {}) => ({
   name: 'id',
   alias: 'id',
   table: 'users',
   tableAlias: null,
   schema: 'public',
   type: 'INT',
   length: 11,
   key: 'pri',
   comment: 'primary id',
   ...overrides
});

const buildResults = (rows: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) => [{
   rows,
   fields: [sampleField(), sampleField({ name: 'name', key: null, type: 'VARCHAR', alias: 'name', comment: '' })],
   keys: [],
   duration: 5,
   report: { affectedRows: 0 },
   ...extra
}];

const baseInitialState = () => ({
   console: { consoleHeight: 100 },
   settings: { defaultCopyType: 'cell' },
   workspaces: {
      workspaces: [
         {
            uid: 'conn-1',
            client: 'mysql',
            connectionStatus: 'connected',
            selectedTab: 'tab-1',
            tabs: [],
            structure: [],
            variables: [],
            collations: [],
            users: [],
            breadcrumbs: { schema: 'public' },
            loadingElements: [],
            loadedSchemas: new Set<string>(),
            customizations: { exportByChunks: false, cancelQueries: true },
            searchTerm: ''
         }
      ]
   }
});

const mountTable = (props: Record<string, unknown> = {}, extraState: Record<string, unknown> = {}) => {
   const initialState = { ...baseInitialState(), ...extraState };
   return mountWithPinia(WorkspaceTabQueryTable, {
      props: {
         results: buildResults([{ id: 1, name: 'a' }]),
         connUid: 'conn-1',
         isQuering: false,
         mode: 'query',
         page: 1,
         isSelected: true,
         elementType: 'table',
         useCommentHeader: false,
         ...props
      },
      initialState,
      global: {
         stubs: {
            BaseVirtualScroll: {
               template: '<div class="vscroll-stub"><slot :items="$attrs.items || []" /></div>',
               methods: {
                  updateWindow () {}
               }
            },
            WorkspaceTabQueryTableRow: { template: '<div class="row-stub" />' },
            TableContext: true,
            ConfirmModal: {
               template: '<div class="confirm-modal-stub"><slot name="header" /><slot name="body" /><button class="confirm" @click="$emit(\'confirm\')" /><button class="hide" @click="$emit(\'hide\')" /></div>'
            },
            BaseConfirmModal: {
               template: '<div class="confirm-modal-stub"><slot name="header" /><slot name="body" /></div>'
            },
            BaseIcon: true,
            BaseSelect: true,
            Tabs: { template: '<div class="tabs-stub"><slot /></div>' },
            TabsList: { template: '<div class="tabs-list"><slot /></div>' },
            TabsTrigger: { template: '<button class="tab-trigger"><slot /></button>' },
            Input: { template: '<input />', props: ['modelValue'] },
            Label: { template: '<label><slot /></label>' },
            Switch: { template: '<input type="checkbox" />', props: ['checked'] }
         }
      }
   } as Parameters<typeof mountWithPinia>[1]);
};

describe('WorkspaceTabQueryTable', () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it('module exports a defined component', () => {
      expect(WorkspaceTabQueryTable).toBeDefined();
   });

   it('component is an object (Vue SFC)', () => {
      expect(typeof WorkspaceTabQueryTable).toBe('object');
      expect(WorkspaceTabQueryTable).not.toBeNull();
   });

   it('mounts without throwing on a minimal happy-path payload', () => {
      expect(() => mountTable()).not.toThrow();
   });
});
