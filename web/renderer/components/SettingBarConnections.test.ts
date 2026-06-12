/**
 * Tests for SettingBarConnections — sidebar connection list with
 * drag-to-reorder, drag-to-folder, and selection clicks.
 *
 * The component wraps `vuedraggable`, ContextMenu, and a recursive folder
 * variant. We stub Draggable as a passthrough that exposes a `#item` slot
 * per element, then assert: mount, item rendering, click → selectWorkspace,
 * folder rendering for isFolder elements.
 */
import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { type SidebarElement } from '@/stores/connections';
import { useWorkspacesStore } from '@/stores/workspaces';

import SettingBarConnections from './SettingBarConnections.vue';

// Pass-through Draggable that renders the `#item` slot for every element in
// the list — gives us the same DOM shape vuedraggable would produce.
const DraggableStub = {
   name: 'Draggable',
   props: ['list'],
   template: `
      <div class="draggable-stub">
         <template v-for="(element, idx) in list" :key="element.uid || idx">
            <slot name="item" :element="element" :index="idx" />
         </template>
      </div>
   `
};

const mountList = (
   modelValue: SidebarElement[] = [],
   initialState: Record<string, unknown> = {}
) => {
   // Use mount() directly here: mountWithPinia()'s typed `props` slot trips
   // vue-tsc on the recursive SettingBarConnections SFC (generic depth).
   // BaseUploadInput.test.ts uses the same pattern with the as-cast.
   const pinia = createTestingPinia({ stubActions: true, initialState, createSpy: vi.fn });
   return mount(SettingBarConnections, {
      props: { modelValue },
      global: {
         plugins: [pinia],
         stubs: {
            Draggable: DraggableStub,
            BaseIcon: true,
            SettingBarConnectionsFolder: true,
            ContextMenu: { template: '<div><slot /></div>' },
            ContextMenuTrigger: { template: '<div><slot /></div>' },
            SettingBarContext: true
         },
         directives: { tooltip: () => {} }
      }
   } as Parameters<typeof mount>[1]);
};

describe('SettingBarConnections', () => {
   it('mounts without throwing on an empty list', () => {
      expect(() => mountList()).not.toThrow();
   });

   it('renders one .settingbar-element per non-folder connection', () => {
      const wrapper = mountList([
         { uid: 'C:1', isFolder: false, client: 'mysql', icon: null },
         { uid: 'C:2', isFolder: false, client: 'pg', icon: null }
      ]);
      const elements = wrapper.findAll('.settingbar-element');
      expect(elements.length).toBe(2);
   });

   it('clicking a connection element calls selectWorkspace with its uid', async () => {
      const wrapper = mountList([
         { uid: 'C:42', isFolder: false, client: 'mysql', icon: null }
      ]);
      const workspacesStore = useWorkspacesStore();
      await wrapper.find('.settingbar-element').trigger('click');
      expect(workspacesStore.selectWorkspace).toHaveBeenCalledWith('C:42');
   });

   it('renders SettingBarConnectionsFolder for folder elements', () => {
      const wrapper = mountList([
         { uid: 'F:1', isFolder: true, connections: ['C:1'] }
      ]);
      // Folder stub appears as <setting-bar-connections-folder-stub>
      expect(wrapper.html()).toContain('setting-bar-connections-folder-stub');
   });

   it('hides connection items already inside a folder', () => {
      const wrapper = mountList(
         [
            { uid: 'F:1', isFolder: true, connections: ['C:nested'] },
            { uid: 'C:nested', isFolder: false, client: 'mysql', icon: null }
         ],
         {
            connections: {
               connectionsOrder: [
                  { uid: 'F:1', isFolder: true, connections: ['C:nested'] }
               ]
            }
         }
      );
      // Only the folder (1 .settingbar-element wrapper inside the folder
      // stub) should render visible items — the nested C:nested is hidden
      // by the v-if=isFolder || !folderedConnections.includes(uid).
      // The folder is rendered via SettingBarConnectionsFolder stub, not as
      // a .settingbar-element directly.
      expect(wrapper.findAll('.settingbar-element').length).toBe(0);
   });
});
