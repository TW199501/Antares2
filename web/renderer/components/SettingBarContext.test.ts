/**
 * Tests for SettingBarContext.vue — the right-click context menu shown over
 * a sidebar connection or folder element. Owns:
 *   - Disconnect item (only when isConnected)
 *   - "Move to" submenu with NewFolder + folder list + outOfFolder, hidden
 *     when contextConnection.isFolder
 *   - Appearance / Duplicate (connection only) / Delete items
 *   - ConfirmModal toggle + confirmDelete path that calls
 *     deleteConnection (and optionally disconnectWorkspace if connected)
 *   - Appearance modal toggling — folder vs connection variant based on
 *     contextConnection.isFolder
 *
 * The component renders a `ContextMenuContent` directly (no Root). We stub the
 * menu primitives as passthrough divs so we can probe template rendering and
 * dispatch `select` via click. The two appearance modals + ConfirmModal get
 * passthrough stubs so we can drive @confirm / @hide / @close.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import SettingBarContext from './SettingBarContext.vue';

// ConfirmModal passthrough — slot-passthrough shell that re-emits both events.
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

const ModalFolderAppearanceStub = {
   name: 'ModalFolderAppearance',
   emits: ['close'],
   template: '<div class="folder-appearance-stub" />'
};

const ModalConnectionAppearanceStub = {
   name: 'ModalConnectionAppearance',
   emits: ['close'],
   template: '<div class="connection-appearance-stub" />'
};

const ContextMenuContentStub = {
   template: '<div class="ctx-content-stub"><slot /></div>'
};

const ContextMenuItemStub = {
   name: 'ContextMenuItem',
   emits: ['select'],
   template: '<div class="ctx-item-stub" @click="$emit(\'select\')"><slot /></div>'
};

const ContextMenuSeparatorStub = {
   template: '<div class="ctx-sep-stub" />'
};

const ContextMenuSubStub = {
   template: '<div class="ctx-sub-stub"><slot /></div>'
};

const ContextMenuSubTriggerStub = {
   template: '<div class="ctx-sub-trigger-stub"><slot /></div>'
};

const ContextMenuSubContentStub = {
   template: '<div class="ctx-sub-content-stub"><slot /></div>'
};

const baseConnections = [
   { uid: 'C:1', name: 'orders-db', client: 'mysql', host: 'localhost', port: 3306, user: 'root' }
];

// Folder F:1 contains C:1; folder F:2 is unrelated.
const baseConnectionsOrder = [
   { uid: 'F:1', isFolder: true, name: 'Production', color: '#FF5000', connections: ['C:1'] },
   { uid: 'F:2', isFolder: true, name: 'Staging', color: '#48CFAD', connections: [] },
   { uid: 'C:1', isFolder: false, client: 'mysql' }
];

const mountCtx = (
   propOverrides: Record<string, unknown> = {},
   stateOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(SettingBarContext, {
      props: {
         contextConnection: { uid: 'C:1', isFolder: false, client: 'mysql' },
         ...propOverrides
      } as never,
      initialState: {
         connections: {
            connections: baseConnections,
            connectionsOrder: baseConnectionsOrder,
            customIcons: [],
            ...(stateOverrides.connections as Record<string, unknown> ?? {})
         },
         workspaces: {
            workspaces: [
               { uid: 'C:1', client: 'mysql', connectionStatus: 'disconnected', tabs: [] }
            ],
            selectedWorkspace: null,
            ...(stateOverrides.workspaces as Record<string, unknown> ?? {})
         },
         notifications: { notifications: [] }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            ConfirmModal: ConfirmModalStub,
            ModalFolderAppearance: ModalFolderAppearanceStub,
            ModalConnectionAppearance: ModalConnectionAppearanceStub,
            ContextMenuContent: ContextMenuContentStub,
            ContextMenuItem: ContextMenuItemStub,
            ContextMenuSeparator: ContextMenuSeparatorStub,
            ContextMenuSub: ContextMenuSubStub,
            ContextMenuSubTrigger: ContextMenuSubTriggerStub,
            ContextMenuSubContent: ContextMenuSubContentStub
         }
      }
   });
};

describe('SettingBarContext', () => {
   it('mounts without throwing for a non-folder connection (default)', () => {
      expect(() => mountCtx()).not.toThrow();
   });

   it('omits Disconnect item when the workspace is disconnected', () => {
      const wrapper = mountCtx();
      expect(wrapper.html()).not.toContain('connection.disconnect');
   });

   it('renders Disconnect item when the workspace is connected', () => {
      const wrapper = mountCtx(
         { contextConnection: { uid: 'C:1', isFolder: false, client: 'mysql' } },
         {
            workspaces: {
               workspaces: [
                  { uid: 'C:1', client: 'mysql', connectionStatus: 'connected', tabs: [] }
               ],
               selectedWorkspace: 'C:1'
            }
         }
      );
      expect(wrapper.html()).toContain('connection.disconnect');
   });

   it('hides the "Move to" submenu when contextConnection.isFolder is true', () => {
      const wrapper = mountCtx({
         contextConnection: { uid: 'F:1', isFolder: true, name: 'Production', color: '#FF5000', connections: ['C:1'] }
      });
      // No move submenu trigger
      expect(wrapper.html()).not.toContain('general.moveTo');
      // No duplicate (folders cannot be duplicated)
      expect(wrapper.html()).not.toContain('general.duplicate');
   });

   it('renders the "Move to" submenu plus Duplicate for a regular connection', () => {
      const wrapper = mountCtx();
      expect(wrapper.html()).toContain('general.moveTo');
      expect(wrapper.html()).toContain('general.duplicate');
      expect(wrapper.html()).toContain('application.appearance');
      expect(wrapper.html()).toContain('general.delete');
   });

   it('lists folders that DO NOT already contain the connection (filteredFolders)', () => {
      const wrapper = mountCtx();
      // F:1 contains C:1 → excluded; F:2 empty → included.
      expect(wrapper.html()).toContain('Staging');
      expect(wrapper.html()).not.toContain('Production');
   });

   it('shows the OutOfFolder item only when the connection is currently in a folder', () => {
      const wrapper = mountCtx();
      // C:1 is in folder F:1 → outOfFolder rendered
      expect(wrapper.html()).toContain('application.outOfFolder');
   });

   it('hides OutOfFolder item when the connection is not in any folder', () => {
      const wrapper = mountCtx(
         { contextConnection: { uid: 'C:99', isFolder: false, client: 'mysql' } },
         {
            connections: {
               connections: [
                  { uid: 'C:99', name: 'free', client: 'mysql', host: 'h', port: 1, user: 'u' }
               ],
               connectionsOrder: [
                  { uid: 'F:2', isFolder: true, name: 'Staging', color: '#48CFAD', connections: [] },
                  { uid: 'C:99', isFolder: false, client: 'mysql' }
               ]
            }
         }
      );
      expect(wrapper.html()).not.toContain('application.outOfFolder');
   });

   it('opens the ConfirmModal when the Delete item is selected', async () => {
      const wrapper = mountCtx();
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(false);
      // The last visible ctx-item-stub is "Delete" (red destructive).
      const items = wrapper.findAll('.ctx-item-stub');
      await items[items.length - 1].trigger('click');
      await flushPromises();
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(true);
      expect(wrapper.html()).toContain('connection.deleteConnection');
   });

   it('renders the folder-specific delete header when contextConnection.isFolder', async () => {
      const wrapper = mountCtx({
         contextConnection: { uid: 'F:1', isFolder: true, name: 'Production', color: '#FF5000', connections: ['C:1'] }
      });
      const items = wrapper.findAll('.ctx-item-stub');
      await items[items.length - 1].trigger('click');
      await flushPromises();
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(true);
      expect(wrapper.html()).toContain('application.deleteFolder');
   });

   it('hide event from ConfirmModal closes the dialog', async () => {
      const wrapper = mountCtx();
      const items = wrapper.findAll('.ctx-item-stub');
      await items[items.length - 1].trigger('click');
      await flushPromises();
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(true);
      await wrapper.find('.cm-hide-btn').trigger('click');
      await flushPromises();
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(false);
   });

   it('clicking Appearance shows the connection appearance modal for a non-folder', async () => {
      const wrapper = mountCtx();
      // Locate the Appearance item by text content
      const items = wrapper.findAll('.ctx-item-stub');
      const appearance = items.find(i => i.html().includes('application.appearance'));
      expect(appearance).toBeTruthy();
      await appearance!.trigger('click');
      await flushPromises();
      expect(wrapper.find('.connection-appearance-stub').exists()).toBe(true);
      expect(wrapper.find('.folder-appearance-stub').exists()).toBe(false);
   });

   it('clicking Appearance shows the folder appearance modal for a folder', async () => {
      const wrapper = mountCtx({
         contextConnection: { uid: 'F:1', isFolder: true, name: 'Production', color: '#FF5000', connections: ['C:1'] }
      });
      const items = wrapper.findAll('.ctx-item-stub');
      const appearance = items.find(i => i.html().includes('application.appearance'));
      expect(appearance).toBeTruthy();
      await appearance!.trigger('click');
      await flushPromises();
      expect(wrapper.find('.folder-appearance-stub').exists()).toBe(true);
      expect(wrapper.find('.connection-appearance-stub').exists()).toBe(false);
   });

   it('exports the component as an SFC object', () => {
      expect(SettingBarContext).toBeDefined();
      expect(typeof SettingBarContext).toBe('object');
   });
});
