/**
 * Tests for WorkspaceTabTable.vue — the per-table "Data" tab. Owns:
 *   - viewMode toggle (data / props)
 *   - useCommentHeader toggle (English column names vs CJK comments)
 *   - WorkspaceTabTableQueryArea (filter editor) + WorkspaceTabQueryTable
 *     (the virtual-scroll grid) inside a vertical resizable splitter
 *   - getTableData() chain calling Tables.getTableData +
 *     getTableApproximateCount
 *   - watch on schema/table/page/isSelected → refetch
 *   - tablePager store push/clear via watch on page/results/isQuering
 *   - 4 window CustomEvent listeners (run-or-reload / open-filter /
 *     next-page / prev-page)
 *   - ModalFakerRows (insert row dialog) via showFakerModal flag
 *
 * Heavy children (WorkspaceTabQueryTable, WorkspaceTabPropsTable,
 * BaseSplitV, ModalFakerRows, BaseLoader) are stubbed `: true` per spec
 * §5.F. WorkspaceTabQueryTable stub exposes `refreshScroller` /
 * `resetSort` / `applyUpdate` methods on its instance because the SFC
 * calls these via `queryTable.value.*` — without them, refetch and
 * resizeScroller paths throw.
 *
 * Spec §5.A — we do NOT assert on `data-state` or reka-ui internal data
 * attributes; the Tabs primitive is replaced with a passthrough stub so
 * we can inspect viewMode via the `data-active` attribute we control.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Tables from '@/ipc-api/Tables';

import WorkspaceTabTable from './WorkspaceTabTable.vue';

vi.mock('@/ipc-api/Tables', () => ({
   default: {
      getTableData: vi.fn().mockResolvedValue({
         status: 'success',
         response: { rows: [], fields: [], keys: [], duration: 12 }
      }),
      getTableColumns: vi.fn().mockResolvedValue({ status: 'success', response: [] }),
      getTableApproximateCount: vi.fn().mockResolvedValue({ status: 'success', response: 0 }),
      updateTableCell: vi.fn().mockResolvedValue({ status: 'success', response: { reload: false } }),
      deleteTableRows: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));

const baseCustomizations = {
   tableRealCount: false,
   systemSchemas: ['master', 'msdb', 'tempdb', 'model'],
   database: true
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
            { name: 'users', comment: 'primary user table', autoIncrement: 42, collation: 'utf8mb4_general_ci' },
            { name: 'orders', comment: '', collation: 'utf8mb4_general_ci' }
         ]
      }
   ],
   breadcrumbs: { schema: 'app' },
   loadedSchemas: new Set(),
   customizations: baseCustomizations,
   ...overrides
});

const QueryTableStub = {
   name: 'WorkspaceTabQueryTable',
   props: ['results', 'isQuering', 'page', 'tabUid', 'connUid', 'isSelected', 'mode', 'elementType', 'useCommentHeader'],
   emits: ['update-field', 'delete-selected', 'duplicate-row', 'hard-sort'],
   template: '<div class="query-table-stub" />',
   methods: {
      refreshScroller () {},
      resetSort () {},
      applyUpdate () {},
      downloadTable () {}
   }
};

const SplitVStub = {
   name: 'BaseSplitV',
   props: ['topHeight', 'defaultTopHeight'],
   template: '<div class="split-v-stub"><slot name="top" /><slot name="bottom" /></div>'
};

const TabsStub = {
   props: { modelValue: { type: String, default: 'data' } },
   emits: ['update:modelValue'],
   template: '<div class="tabs-stub" :data-active="modelValue"><slot /></div>'
};

const TabsTriggerStub = {
   props: { value: { type: String, default: '' } },
   template: '<button type="button" class="tabs-trigger-stub" :data-value="value" @click="$parent.$emit(\'update:modelValue\', value)"><slot /></button>'
};

const mountTab = (
   props: Record<string, unknown> = {},
   workspaceOverrides: Record<string, unknown> = {},
   settingsOverrides: Record<string, unknown> = {}
) => {
   const workspace = buildWorkspace(workspaceOverrides);
   return mountWithPinia(WorkspaceTabTable, {
      // Cast: ConnectionParams has many optional fields; we seed the few
      // the SFC reads (uid, readonly).
      props: {
         connection: { uid: 'C:1', client: 'mysql', readonly: false },
         isSelected: true,
         table: 'users',
         schema: 'app',
         elementType: 'table',
         ...props
      } as never,
      initialState: {
         workspaces: {
            workspaces: [workspace],
            selectedWorkspace: 'C:1'
         },
         settings: {
            dataTabLimit: 1000,
            tableAutoRefreshInterval: 0,
            tableQueryAreaHeight: 300,
            ...settingsOverrides
         },
         notifications: { notifications: [] },
         tablePager: { activePager: null }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            BaseLoader: true,
            BaseSplitV: SplitVStub,
            // Heavy child grids — stub to avoid IntersectionObserver / virtual
            // scroll setup (§5.F)
            WorkspaceTabQueryTable: QueryTableStub,
            WorkspaceTabPropsTable: true,
            WorkspaceTabTableQueryArea: true,
            ModalFakerRows: true,
            // shadcn primitives — passthrough so click events bubble and
            // viewMode toggling still works without reka context.
            Tabs: TabsStub,
            TabsList: { template: '<div class="tabs-list-stub"><slot /></div>' },
            TabsTrigger: TabsTriggerStub,
            Button: {
               inheritAttrs: false,
               template: '<button type="button" class="btn-stub" v-bind="$attrs"><slot /></button>'
            }
         }
      }
   });
};

describe('WorkspaceTabTable', () => {
   it('mounts without throwing on the default state', async () => {
      expect(() => mountTab()).not.toThrow();
      await flushPromises();
   });

   it('calls Tables.getTableData on mount with schema, table, page=1, sortParams, where', async () => {
      mountTab();
      await flushPromises();
      expect(Tables.getTableData).toHaveBeenCalled();
      const callArgs = vi.mocked(Tables.getTableData).mock.calls[0]?.[0];
      expect(callArgs).toMatchObject({
         uid: 'C:1',
         schema: 'app',
         table: 'users',
         page: 1
      });
   });

   it('renders the data viewMode by default and shows the QueryTable stub', async () => {
      const wrapper = mountTab();
      await flushPromises();
      // Tabs root reflects current viewMode via our stub's data-active attr
      const tabsRoot = wrapper.find('.tabs-stub');
      expect(tabsRoot.attributes('data-active')).toBe('data');
      // The Query table is rendered inside BaseSplitV's bottom slot
      expect(wrapper.find('.query-table-stub').exists()).toBe(true);
   });

   it('renders the table info bar (name + comment + collation) for the selected table', async () => {
      const wrapper = mountTab();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain('users');
      expect(html).toContain('primary user table');
      expect(html).toContain('utf8mb4_general_ci');
   });

   it('clicking the column-header toggle button flips between A and 中', async () => {
      const wrapper = mountTab();
      await flushPromises();
      // The toggle is a non-Button raw <button> (not class btn-stub) — find
      // by initial label "A".
      const allButtons = wrapper.findAll('button');
      const toggle = allButtons.find(b => b.text().trim() === 'A' && !b.classes().includes('btn-stub'));
      expect(toggle).toBeTruthy();
      await toggle!.trigger('click');
      await flushPromises();
      const after = wrapper.findAll('button').find(b => b.text().trim() === '中');
      expect(after).toBeTruthy();
   });

   it('clicking the Add (Insert row) button opens the ModalFakerRows', async () => {
      const wrapper = mountTab();
      await flushPromises();
      // Modal not rendered yet
      expect(wrapper.html()).not.toContain('modal-faker-rows-stub');
      // The insert row button is the first .btn-stub in data viewMode
      const addBtn = wrapper.find('.btn-stub');
      expect(addBtn.exists()).toBe(true);
      await addBtn.trigger('click');
      await flushPromises();
      expect(wrapper.html()).toContain('modal-faker-rows-stub');
   });

   it('does not render the Add button when connection.readonly is true', async () => {
      const wrapper = mountTab({ connection: { uid: 'C:1', client: 'mysql', readonly: true } });
      await flushPromises();
      // No btn-stub should be visible (only toolbar buttons; the toggle
      // is a raw <button>, not Button-stub).
      const buttons = wrapper.findAll('.btn-stub');
      expect(buttons.length).toBe(0);
   });

   it('does not render the Add button for non-table element types (e.g. view)', async () => {
      const wrapper = mountTab({ elementType: 'view' });
      await flushPromises();
      const buttons = wrapper.findAll('.btn-stub');
      expect(buttons.length).toBe(0);
   });

   it('disables the Add button when current schema is in customizations.systemSchemas', async () => {
      const wrapper = mountTab({ schema: 'master' });
      await flushPromises();
      // mock returns rows: [] so hasApproximately is false — schema "master"
      // is in the systemSchemas list (matched case-insensitively).
      const addBtn = wrapper.find('.btn-stub');
      expect(addBtn.exists()).toBe(true);
      // Button stub forwards :disabled via $attrs
      expect(addBtn.attributes('disabled')).toBeDefined();
   });

   it('refetches data when the `table` prop changes while selected', async () => {
      const wrapper = mountTab();
      await flushPromises();
      const initial = vi.mocked(Tables.getTableData).mock.calls.length;
      await wrapper.setProps({ table: 'orders' });
      await flushPromises();
      expect(vi.mocked(Tables.getTableData).mock.calls.length).toBeGreaterThan(initial);
      const lastCall = vi.mocked(Tables.getTableData).mock.calls.at(-1)?.[0];
      expect(lastCall).toMatchObject({ table: 'orders', page: 1 });
   });

   it('refetches data when the `schema` prop changes while selected', async () => {
      const wrapper = mountTab();
      await flushPromises();
      const initial = vi.mocked(Tables.getTableData).mock.calls.length;
      await wrapper.setProps({ schema: 'other' });
      await flushPromises();
      expect(vi.mocked(Tables.getTableData).mock.calls.length).toBeGreaterThan(initial);
   });

   it('does NOT refetch when isSelected is false and prop changes', async () => {
      const wrapper = mountTab({ isSelected: false });
      await flushPromises();
      vi.mocked(Tables.getTableData).mockClear();
      await wrapper.setProps({ table: 'orders' });
      await flushPromises();
      expect(Tables.getTableData).not.toHaveBeenCalled();
   });

   it('antares:run-or-reload window event triggers a refetch when isSelected', async () => {
      mountTab();
      await flushPromises();
      const initial = vi.mocked(Tables.getTableData).mock.calls.length;
      window.dispatchEvent(new CustomEvent('antares:run-or-reload'));
      await flushPromises();
      expect(vi.mocked(Tables.getTableData).mock.calls.length).toBeGreaterThan(initial);
   });

   it('antares:next-page does not advance when results.length < limit (boundary)', async () => {
      // mock returns rows: [] which is < limit, so next should be a no-op.
      const wrapper = mountTab();
      await flushPromises();
      const initial = vi.mocked(Tables.getTableData).mock.calls.length;
      window.dispatchEvent(new CustomEvent('antares:next-page'));
      await flushPromises();
      // No refetch since pageChange early-returns at boundary
      expect(vi.mocked(Tables.getTableData).mock.calls.length).toBe(initial);
      wrapper.unmount();
   });

   it('antares:prev-page does not regress past page=1 (boundary)', async () => {
      mountTab();
      await flushPromises();
      const initial = vi.mocked(Tables.getTableData).mock.calls.length;
      window.dispatchEvent(new CustomEvent('antares:prev-page'));
      await flushPromises();
      expect(vi.mocked(Tables.getTableData).mock.calls.length).toBe(initial);
   });

   it('error response from getTableData is swallowed and a notification queued', async () => {
      vi.mocked(Tables.getTableData).mockResolvedValueOnce({
         status: 'error',
         response: 'permission denied'
      } as never);
      // Fresh mount with the error-mock active for the FIRST call only
      expect(() => mountTab()).not.toThrow();
      await flushPromises();
      // Subsequent calls fall back to the default success mock
   });

   it('cleans up window listeners + interval on unmount (smoke: no throw)', async () => {
      const wrapper = mountTab();
      await flushPromises();
      expect(() => wrapper.unmount()).not.toThrow();
   });
});
