/**
 * Tests for WorkspaceExploreBarSchemaContext.vue — the right-click context
 * menu over a schema sidebar row. Owns:
 *   - Submenu of "Add" entries gated by workspace.customizations.* flags
 *     and connection.readonly
 *   - copyName(selectedSchema) → copyText
 *   - showExportSchemaModal → schemaExport store
 *   - initImport → Application.showOpenDialog → ModalImportSchema
 *   - showEditModal / hideEditModal toggles
 *   - showDeleteModal / hideDeleteModal + Schema.deleteSchema async path
 *
 * The component renders ContextMenuContent directly (no Root wrapper), so we
 * stub the menu primitives as plain divs that re-emit @select on click.
 * ConfirmModal is replaced with a slot-passthrough shell that re-emits
 * @confirm and @hide so we can drive both terminations.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Application from '@/ipc-api/Application';
import Schema from '@/ipc-api/Schema';

import WorkspaceExploreBarSchemaContext from './WorkspaceExploreBarSchemaContext.vue';

vi.mock('@/ipc-api/Schema', () => ({
   default: {
      deleteSchema: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));
vi.mock('@/ipc-api/Application', () => ({
   default: {
      showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] })
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
   tableAdd: true,
   viewAdd: true,
   materializedViewAdd: true,
   triggerAdd: true,
   routineAdd: true,
   functionAdd: true,
   triggerFunctionAdd: true,
   schedulerAdd: true,
   schemaExport: true,
   schemaImport: true,
   schemaEdit: true,
   schemaDrop: true
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

const mountCtx = (
   propOverrides: Record<string, unknown> = {},
   stateOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(WorkspaceExploreBarSchemaContext, {
      props: {
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
            ModalEditSchema: true,
            ModalImportSchema: true,
            ContextMenuContent: { template: '<div class="ctx-content-stub"><slot /></div>' },
            ContextMenuItem: {
               name: 'ContextMenuItem',
               emits: ['select'],
               template: '<div class="ctx-item-stub" @click="$emit(\'select\')"><slot /></div>'
            },
            ContextMenuSub: { template: '<div class="ctx-sub-stub"><slot /></div>' },
            ContextMenuSubTrigger: { template: '<div class="ctx-sub-trigger-stub"><slot /></div>' },
            ContextMenuSubContent: { template: '<div class="ctx-sub-content-stub"><slot /></div>' },
            ContextMenuSeparator: { template: '<div class="ctx-sep-stub" />' }
         }
      }
   });
};

describe('WorkspaceExploreBarSchemaContext', () => {
   it('mounts without throwing under default state', () => {
      expect(() => mountCtx()).not.toThrow();
   });

   it('renders Add submenu trigger when connection is not readonly', () => {
      const wrapper = mountCtx();
      expect(wrapper.html()).toContain('general.add');
      expect(wrapper.find('.ctx-sub-trigger-stub').exists()).toBe(true);
   });

   it('renders the full add-element list when all customization flags are true', () => {
      const wrapper = mountCtx();
      expect(wrapper.html()).toContain('database.table');
      expect(wrapper.html()).toContain('database.view');
      expect(wrapper.html()).toContain('database.materializedView');
      expect(wrapper.html()).toContain('database.trigger');
      expect(wrapper.html()).toContain('database.storedRoutine');
      expect(wrapper.html()).toContain('database.function');
      expect(wrapper.html()).toContain('database.scheduler');
   });

   it('renders Copy Name, Export, Import, Edit, Delete entries', () => {
      const wrapper = mountCtx();
      expect(wrapper.html()).toContain('general.copyName');
      expect(wrapper.html()).toContain('database.export');
      expect(wrapper.html()).toContain('database.import');
      expect(wrapper.html()).toContain('database.editSchema');
      expect(wrapper.html()).toContain('database.deleteSchema');
   });

   it('hides Add submenu, Import, Edit, Delete entries when connection is readonly', () => {
      const wrapper = mountCtx({}, {
         connections: {
            connections: [{ ...baseConnections[0], readonly: true }],
            connectionsOrder: [{ ...baseConnections[0], isFolder: false, readonly: true }]
         }
      });
      // Add submenu rendered only if !connection.readonly
      expect(wrapper.find('.ctx-sub-stub').exists()).toBe(false);
      expect(wrapper.html()).not.toContain('database.import');
      expect(wrapper.html()).not.toContain('database.editSchema');
      expect(wrapper.html()).not.toContain('database.deleteSchema');
      // Copy name and Export are always there (Export only depends on schemaExport flag)
      expect(wrapper.html()).toContain('general.copyName');
   });

   it('Copy Name click invokes copyText with selected schema', async () => {
      const { copyText } = await import('@/libs/copyText');
      const wrapper = mountCtx({ selectedSchema: 'inventory' });
      // First top-level item that emits select for copyName is the one with general.copyName
      const items = wrapper.findAll('.ctx-item-stub');
      const copy = items.find(i => i.text().includes('general.copyName'));
      expect(copy).toBeTruthy();
      await copy!.trigger('click');
      expect(copyText).toHaveBeenCalledWith('inventory');
   });

   it('Delete entry opens the ConfirmModal with the schema name', async () => {
      const wrapper = mountCtx({ selectedSchema: 'analytics' });
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(false);
      const del = wrapper.findAll('.ctx-item-stub').find(i => i.text().includes('database.deleteSchema'));
      expect(del).toBeTruthy();
      await del!.trigger('click');
      await flushPromises();
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(true);
      expect(wrapper.html()).toContain('analytics');
   });

   it('confirming Delete invokes Schema.deleteSchema and emits reload', async () => {
      const wrapper = mountCtx({ selectedSchema: 'old_db' });
      const del = wrapper.findAll('.ctx-item-stub').find(i => i.text().includes('database.deleteSchema'));
      await del!.trigger('click');
      await flushPromises();
      await wrapper.find('.cm-confirm-btn').trigger('click');
      await flushPromises();
      expect(Schema.deleteSchema).toHaveBeenCalledWith({
         uid: 'C:1',
         database: 'old_db'
      });
      expect(wrapper.emitted('reload')).toBeTruthy();
   });

   it('hide button on Delete ConfirmModal closes without calling deleteSchema', async () => {
      const wrapper = mountCtx();
      const del = wrapper.findAll('.ctx-item-stub').find(i => i.text().includes('database.deleteSchema'));
      await del!.trigger('click');
      await flushPromises();
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(true);
      await wrapper.find('.cm-hide-btn').trigger('click');
      await flushPromises();
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(false);
      expect(Schema.deleteSchema).not.toHaveBeenCalled();
   });

   it('Add → Table emits open-create-table-tab', async () => {
      const wrapper = mountCtx();
      const addTable = wrapper.findAll('.ctx-item-stub').find(i => i.text().includes('database.table'));
      expect(addTable).toBeTruthy();
      await addTable!.trigger('click');
      expect(wrapper.emitted('open-create-table-tab')).toBeTruthy();
   });

   it('Add → View emits open-create-view-tab', async () => {
      const wrapper = mountCtx();
      const addView = wrapper.findAll('.ctx-item-stub').find(i => i.text() === 'database.view');
      expect(addView).toBeTruthy();
      await addView!.trigger('click');
      expect(wrapper.emitted('open-create-view-tab')).toBeTruthy();
   });

   it('Import entry calls Application.showOpenDialog when clicked', async () => {
      const wrapper = mountCtx();
      const importItem = wrapper.findAll('.ctx-item-stub').find(i => i.text().includes('database.import'));
      expect(importItem).toBeTruthy();
      await importItem!.trigger('click');
      await flushPromises();
      expect(Application.showOpenDialog).toHaveBeenCalled();
   });
});
