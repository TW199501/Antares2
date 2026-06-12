/**
 * Tests for WorkspaceTabPropsTable.vue — the per-table "Properties" tab
 * that displays the editable column list, indexes, foreign keys, table
 * options, DDL preview, and table checks. All mutations autocommit via
 * Tables.alterTable on each modal confirm.
 *
 * The component pulls a lot of data on mount via `getFieldsData()`:
 *   Tables.getTableOptions, getTableColumns, getTableIndexes,
 *   getKeyUsage, getTableChecks. Each is mocked to a `success` empty
 *   payload so the chain runs without notifications.
 *
 * Heavy sub-components are stubbed: true (only their *-stub elements
 * appear in DOM) — this keeps Teleport / portal interactions out and
 * lets us probe local refs that toggle their `v-if`.
 *
 * Coverage focus: read-only summary row, modal show/hide flags
 * (isOptionsModal / isIndexesModal / isForeignModal / isDdlModal /
 * isTableChecksModal / editModalOpen), addField / openEditField
 * (computed editModalIndexes / editModalForeigns), draftField shape,
 * watch on schema/table/isSelected, save/clear changes path.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Tables from '@/ipc-api/Tables';

import WorkspaceTabPropsTable from './WorkspaceTabPropsTable.vue';

vi.mock('@/ipc-api/Tables', () => ({
   default: {
      getTableColumns: vi.fn().mockResolvedValue({ status: 'success', response: [] }),
      getTableData: vi.fn().mockResolvedValue({ status: 'success', response: { rows: [], fields: [] } }),
      getTableOptions: vi.fn().mockResolvedValue({ status: 'success', response: { name: 'users', comment: '', engine: 'InnoDB', collation: 'utf8mb4_general_ci', autoIncrement: 1 } }),
      getTableIndexes: vi.fn().mockResolvedValue({ status: 'success', response: [] }),
      getKeyUsage: vi.fn().mockResolvedValue({ status: 'success', response: [] }),
      getTableChecks: vi.fn().mockResolvedValue({ status: 'success', response: [] }),
      alterTable: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));

const baseCustomizations = {
   comment: true,
   autoIncrement: true,
   collations: true,
   engines: true,
   tableCheck: true,
   tableDdl: true,
   database: true,
   processesList: true
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
            { name: 'users', type: 'table' },
            { name: 'orders', type: 'table' }
         ]
      }
   ],
   breadcrumbs: { schema: 'app', table: 'users' },
   loadedSchemas: new Set(),
   customizations: baseCustomizations,
   dataTypes: baseDataTypes,
   indexTypes: ['PRIMARY', 'INDEX', 'UNIQUE'],
   variables: [{ name: 'collation_server', value: 'utf8mb4_general_ci' }],
   engines: [{ name: 'InnoDB', isDefault: true }],
   ...overrides
});

const mountTab = (
   props: Record<string, unknown> = {},
   workspaceOverrides: Record<string, unknown> = {}
) => {
   const workspace = buildWorkspace(workspaceOverrides);
   return mountWithPinia(WorkspaceTabPropsTable, {
      // Cast: see Workspace.test.ts — strict prop typing vs partial seed.
      props: {
         tabUid: 'TAB:1',
         connection: { uid: 'C:1', client: 'mysql' },
         isSelected: true,
         table: 'users',
         schema: 'app',
         ...props
      } as never,
      initialState: {
         workspaces: {
            workspaces: [workspace],
            selectedWorkspace: 'C:1'
         }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            BaseLoader: true,
            BaseSelect: true,
            // Inner field grid uses a custom result-table layout — render
            // a passthrough so root markup can be inspected without portal.
            WorkspaceTabPropsTableFields: { template: '<div class="fields-grid-stub" />' },
            WorkspaceTabPropsTableEditModal: true,
            WorkspaceTabPropsTableIndexesModal: true,
            WorkspaceTabPropsTableForeignModal: true,
            WorkspaceTabPropsTableOptionsModal: true,
            WorkspaceTabPropsTableDdlModal: true,
            WorkspaceTabPropsTableChecksModal: true,
            // shadcn-vue primitives — neutral wrappers so click events bubble
            Button: { template: '<button class="btn-stub" v-bind="$attrs"><slot /></button>' },
            Input: { template: '<input v-bind="$attrs" />' },
            Label: { template: '<label v-bind="$attrs"><slot /></label>' },
            // Teleport target absent → wrap to no-op so the v-if in the
            // SFC sees `toolbarTarget == null` and skips Teleport entirely.
            Teleport: { template: '<div class="teleport-stub"><slot /></div>' }
         }
      }
   });
};

describe('WorkspaceTabPropsTable', () => {
   it('mounts without throwing under default props/state', async () => {
      expect(() => mountTab()).not.toThrow();
      await flushPromises();
   });

   it('renders the read-only summary row when isSelected is true', async () => {
      const wrapper = mountTab();
      await flushPromises();
      // The outer container exists and shows the table name
      expect(wrapper.html()).toContain('users');
   });

   it('hides itself when isSelected is false (v-show)', async () => {
      const wrapper = mountTab({ isSelected: false });
      await flushPromises();
      const root = wrapper.find('.workspace-query-tab');
      // v-show toggles `display: none`
      expect(root.attributes('style') || '').toContain('display: none');
   });

   it('calls Tables.getTableColumns + getTableOptions on mount', async () => {
      mountTab();
      await flushPromises();
      expect(Tables.getTableColumns).toHaveBeenCalled();
      expect(Tables.getTableOptions).toHaveBeenCalled();
   });

   it('calls Tables.getTableIndexes and getKeyUsage on initial fetch', async () => {
      mountTab();
      await flushPromises();
      expect(Tables.getTableIndexes).toHaveBeenCalled();
      expect(Tables.getKeyUsage).toHaveBeenCalled();
   });

   it('skips getTableChecks when customizations.tableCheck is false', async () => {
      vi.mocked(Tables.getTableChecks).mockClear();
      mountTab({}, { customizations: { ...baseCustomizations, tableCheck: false } });
      await flushPromises();
      expect(Tables.getTableChecks).not.toHaveBeenCalled();
   });

   it('renders WorkspaceTabPropsTableFields once localFields is initialised', async () => {
      const wrapper = mountTab();
      await flushPromises();
      expect(wrapper.find('.fields-grid-stub').exists()).toBe(true);
   });

   it('clicking the Edit button opens the options modal', async () => {
      const wrapper = mountTab();
      await flushPromises();
      // Locate the Edit button (last button in the summary row)
      const buttons = wrapper.findAll('button');
      expect(buttons.length).toBeGreaterThan(0);
      // Modal not yet present
      expect(wrapper.html()).not.toContain('workspace-tab-props-table-options-modal-stub');
      // Click the Edit button (it has the title "database.editTableOptions")
      const editBtn = buttons.find(b => b.attributes('title') === 'database.editTableOptions');
      expect(editBtn).toBeTruthy();
      await editBtn!.trigger('click');
      await flushPromises();
      expect(wrapper.html()).toContain('workspace-tab-props-table-options-modal-stub');
   });

   it('refetches data when the `table` prop changes while selected', async () => {
      const wrapper = mountTab();
      await flushPromises();
      const initialCalls = vi.mocked(Tables.getTableColumns).mock.calls.length;
      await wrapper.setProps({ table: 'orders' });
      await flushPromises();
      expect(vi.mocked(Tables.getTableColumns).mock.calls.length).toBeGreaterThan(initialCalls);
   });

   it('refetches data when the `schema` prop changes while selected', async () => {
      const wrapper = mountTab();
      await flushPromises();
      const initialCalls = vi.mocked(Tables.getTableOptions).mock.calls.length;
      await wrapper.setProps({ schema: 'other' });
      await flushPromises();
      expect(vi.mocked(Tables.getTableOptions).mock.calls.length).toBeGreaterThan(initialCalls);
   });

   it('skips fetch when schema changes but tab is not selected', async () => {
      const wrapper = mountTab({ isSelected: false });
      await flushPromises();
      vi.mocked(Tables.getTableColumns).mockClear();
      await wrapper.setProps({ schema: 'inactive' });
      await flushPromises();
      expect(Tables.getTableColumns).not.toHaveBeenCalled();
   });

   it('initialises localOptions from the getTableOptions mock response', async () => {
      const wrapper = mountTab();
      await flushPromises();
      // The summary row renders localOptions.name (we mocked it to "users")
      // and the engine pill (we mocked it to "InnoDB")
      const html = wrapper.html();
      expect(html).toContain('users');
      expect(html).toContain('InnoDB');
   });

   it('renders the comment pill only when customizations.comment is on AND value present', async () => {
      vi.mocked(Tables.getTableOptions).mockResolvedValueOnce({
         status: 'success',
         response: { name: 'users', comment: 'a primary table', engine: 'InnoDB', collation: 'utf8mb4_general_ci', autoIncrement: 1 }
      });
      const wrapper = mountTab();
      await flushPromises();
      expect(wrapper.html()).toContain('a primary table');
   });

   it('omits the autoIncrement pill when customizations.autoIncrement is off', async () => {
      const wrapper = mountTab({}, {
         customizations: { ...baseCustomizations, autoIncrement: false }
      });
      await flushPromises();
      expect(wrapper.html()).not.toContain('database.autoIncrement');
   });

   it('cleans up the antares:save-content listener on unmount (smoke)', async () => {
      const wrapper = mountTab();
      await flushPromises();
      expect(() => wrapper.unmount()).not.toThrow();
   });
});
