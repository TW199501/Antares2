/**
 * Tests for WorkspaceExploreBarTableContext.vue — the right-click context
 * menu over a table/view sidebar row. Owns:
 *   - Type-conditional menu items: Settings (table/view/materializedView),
 *     Copy Name, Export, Duplicate, Empty, Delete
 *   - copyName via copyText
 *   - openTableSettingTab / openViewSettingTab / openMaterializedViewSettingTab
 *     → workspacesStore.newTab + changeBreadcrumbs
 *   - duplicateTable → emit('duplicate-table')
 *   - showEmptyModal + emptyTable → Tables.truncateTable + emit('reload')
 *   - showDeleteModal + deleteTable → emit('delete-table')
 *
 * ConfirmModal is replaced by a slot-passthrough shell that re-emits the
 * @confirm and @hide events.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Tables from '@/ipc-api/Tables';

import WorkspaceExploreBarTableContext from './WorkspaceExploreBarTableContext.vue';

vi.mock('@/ipc-api/Tables', () => ({
   default: {
      truncateTable: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));
vi.mock('@/libs/copyText', () => ({
   copyText: vi.fn()
}));

const ConfirmModalStub = {
   name: 'ConfirmModal',
   inheritAttrs: false,
   emits: ['confirm', 'hide'],
   template: `
      <div class="confirm-modal-stub">
         <div class="cm-header"><slot name="header" /></div>
         <div class="cm-body"><slot name="body" /></div>
         <button type="button" class="cm-confirm-btn" @click="$emit('confirm')">confirm</button>
         <button type="button" class="cm-hide-btn" @click="$emit('hide')">hide</button>
      </div>
   `
};

const baseCustomizations = {
   tableSettings: true,
   viewSettings: true,
   materializedViewSettings: true,
   schemaExport: true,
   tableDuplicate: true,
   tableTruncateDisableFKCheck: true
};

const baseConnections = [
   { uid: 'C:1', name: 'app-mysql', client: 'mysql', readonly: false }
];

const baseWorkspace = {
   uid: 'C:1',
   client: 'mysql',
   database: 'app',
   connectionStatus: 'connected',
   tabs: [],
   selectedTab: null,
   structure: [],
   breadcrumbs: { schema: 'app' },
   loadedSchemas: new Set(),
   customizations: baseCustomizations
};

const baseTable = { name: 'orders', type: 'table' };

const mountCtx = (
   propOverrides: Record<string, unknown> = {},
   stateOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(WorkspaceExploreBarTableContext, {
      props: {
         selectedTable: baseTable,
         selectedSchema: 'app',
         ...propOverrides
      } as never,
      initialState: {
         connections: {
            connections: baseConnections,
            connectionsOrder: baseConnections.map(c => ({ ...c, isFolder: false })),
            ...(stateOverrides.connections as Record<string, unknown> ?? {})
         },
         workspaces: {
            workspaces: [baseWorkspace],
            selectedWorkspace: 'C:1',
            ...(stateOverrides.workspaces as Record<string, unknown> ?? {})
         },
         schemaExport: {},
         notifications: { notifications: [] }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            ConfirmModal: ConfirmModalStub,
            ContextMenuContent: { template: '<div class="ctx-content-stub"><slot /></div>' },
            ContextMenuItem: {
               name: 'ContextMenuItem',
               emits: ['select'],
               template: '<div class="ctx-item-stub" @click="$emit(\'select\')"><slot /></div>'
            },
            ContextMenuSeparator: { template: '<div class="ctx-sep-stub" />' }
         }
      }
   });
};

describe('WorkspaceExploreBarTableContext', () => {
   it('mounts without throwing under default selectedTable=table', () => {
      expect(() => mountCtx()).not.toThrow();
   });

   it('renders Settings + CopyName + Export + Duplicate + Empty + Delete for a table', () => {
      const wrapper = mountCtx();
      const html = wrapper.html();
      expect(html).toContain('application.settings');
      expect(html).toContain('general.copyName');
      expect(html).toContain('database.exportTable');
      expect(html).toContain('database.duplicateTable');
      expect(html).toContain('database.emptyTable');
      expect(html).toContain('database.deleteTable');
   });

   it('omits write actions when the connection is readonly', () => {
      const wrapper = mountCtx({}, {
         connections: {
            connections: [{ ...baseConnections[0], readonly: true }],
            connectionsOrder: [{ ...baseConnections[0], isFolder: false, readonly: true }]
         }
      });
      const html = wrapper.html();
      expect(html).not.toContain('database.duplicateTable');
      expect(html).not.toContain('database.emptyTable');
      expect(html).not.toContain('database.deleteTable');
      // CopyName + Settings + Export still present
      expect(html).toContain('general.copyName');
      expect(html).toContain('application.settings');
   });

   it('renders the View settings entry when selectedTable.type === "view"', () => {
      const wrapper = mountCtx({
         selectedTable: { name: 'v_summary', type: 'view' }
      });
      // type=view → settings still shows (viewSettings flag), no exportTable / duplicate / empty
      expect(wrapper.html()).toContain('application.settings');
      expect(wrapper.html()).not.toContain('database.exportTable');
      expect(wrapper.html()).not.toContain('database.duplicateTable');
      expect(wrapper.html()).not.toContain('database.emptyTable');
   });

   it('renders the Materialized View settings entry when type === "materializedView"', () => {
      const wrapper = mountCtx({
         selectedTable: { name: 'mv_daily', type: 'materializedView' }
      });
      expect(wrapper.html()).toContain('application.settings');
   });

   it('Copy Name click invokes copyText with the table name', async () => {
      const { copyText } = await import('@/libs/copyText');
      const wrapper = mountCtx({ selectedTable: { name: 'invoices', type: 'table' } });
      const copy = wrapper.findAll('.ctx-item-stub').find(i => i.text().includes('general.copyName'));
      await copy!.trigger('click');
      expect(copyText).toHaveBeenCalledWith('invoices');
   });

   it('Duplicate Table click emits duplicate-table with payload', async () => {
      const wrapper = mountCtx({ selectedTable: { name: 'orders', type: 'table' } });
      const dup = wrapper.findAll('.ctx-item-stub').find(i => i.text().includes('database.duplicateTable'));
      await dup!.trigger('click');
      const events = wrapper.emitted('duplicate-table');
      expect(events).toBeTruthy();
      expect(events![0][0]).toMatchObject({
         schema: 'app',
         table: { name: 'orders', type: 'table' }
      });
   });

   it('Delete click opens the delete ConfirmModal with the table name', async () => {
      const wrapper = mountCtx({ selectedTable: { name: 'orders', type: 'table' } });
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(false);
      const del = wrapper.findAll('.ctx-item-stub').find(i => i.text().includes('database.deleteTable'));
      await del!.trigger('click');
      await flushPromises();
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(true);
      expect(wrapper.html()).toContain('orders');
   });

   it('confirming Delete emits delete-table with schema and table payload', async () => {
      const wrapper = mountCtx({ selectedTable: { name: 'orders', type: 'table' } });
      const del = wrapper.findAll('.ctx-item-stub').find(i => i.text().includes('database.deleteTable'));
      await del!.trigger('click');
      await flushPromises();
      await wrapper.find('.cm-confirm-btn').trigger('click');
      await flushPromises();
      const events = wrapper.emitted('delete-table');
      expect(events).toBeTruthy();
      expect(events![0][0]).toMatchObject({
         schema: 'app',
         table: { name: 'orders', type: 'table' }
      });
   });

   it('Empty Table → confirm calls Tables.truncateTable and emits reload', async () => {
      const wrapper = mountCtx({ selectedTable: { name: 'orders', type: 'table' } });
      const empty = wrapper.findAll('.ctx-item-stub').find(i => i.text().includes('database.emptyTable'));
      await empty!.trigger('click');
      await flushPromises();
      // Two ConfirmModal instances may render across switches; the only one
      // currently mounted is the empty modal because isEmptyModal=true.
      await wrapper.find('.cm-confirm-btn').trigger('click');
      await flushPromises();
      expect(Tables.truncateTable).toHaveBeenCalledWith({
         uid: 'C:1',
         table: 'orders',
         schema: 'app',
         force: false
      });
      expect(wrapper.emitted('reload')).toBeTruthy();
   });

   it('Delete ConfirmModal hide closes the modal without firing delete-table', async () => {
      const wrapper = mountCtx({ selectedTable: { name: 'orders', type: 'table' } });
      const del = wrapper.findAll('.ctx-item-stub').find(i => i.text().includes('database.deleteTable'));
      await del!.trigger('click');
      await flushPromises();
      await wrapper.find('.cm-hide-btn').trigger('click');
      await flushPromises();
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(false);
      expect(wrapper.emitted('delete-table')).toBeFalsy();
   });
});
