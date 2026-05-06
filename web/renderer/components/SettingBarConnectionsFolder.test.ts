/**
 * Tests for SettingBarConnectionsFolder.vue — sidebar folder element with
 * open/close state (persisted in localStorage 'opened-folders'), nested
 * connection list inside a vuedraggable, drag-into-folder area, and a
 * ContextMenu wrapper. Most logic is local refs + emits; the only async
 * surface is ContextMenu rendering, which we passthrough-stub.
 *
 * The component reads from useConnectionsStore + useWorkspacesStore via
 * `storeToRefs(...)`. We seed the stores via mountWithPinia's initialState.
 *
 * Spec §5.B / 5.A — we don't probe reka-ui ContextMenu internals; passthrough
 * stubs let us inspect template rendering without portal traversal.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import SettingBarConnectionsFolder from './SettingBarConnectionsFolder.vue';

// vuedraggable Draggable: passthrough that surfaces #header + #item slots and
// re-emits the start / end events used by the SFC.
const DraggableStub = {
   name: 'Draggable',
   props: { list: { type: Array, default: () => [] } },
   emits: ['start', 'end'],
   template: `
      <div class="draggable-stub" v-bind="$attrs">
         <slot name="header" />
         <template v-for="(element, idx) in list" :key="element">
            <slot name="item" :element="element" :index="idx" />
         </template>
      </div>
   `
};

// ContextMenu / ContextMenuTrigger passthroughs (so the inner #default slot
// renders) — testing the actual radix popper would need a portal traversal.
const ContextMenuStub = { template: '<div class="ctx-menu-stub"><slot /></div>' };
const ContextMenuTriggerStub = { template: '<div class="ctx-trigger-stub"><slot /></div>' };

const baseFolder = {
   uid: 'F:1',
   isFolder: true,
   name: 'Production DBs',
   color: '#FF5000',
   connections: ['C:42', 'C:43']
};

const baseConnections = [
   { uid: 'C:42', name: 'orders-db', client: 'mysql' },
   { uid: 'C:43', name: 'analytics-db', client: 'pg' }
];

const baseConnectionsOrder = [
   baseFolder,
   { uid: 'C:42', isFolder: false, client: 'mysql' },
   { uid: 'C:43', isFolder: false, client: 'pg' }
];

const mountFolder = (
   propOverrides: Record<string, unknown> = {},
   stateOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(SettingBarConnectionsFolder, {
      props: {
         folder: baseFolder,
         folderDrag: false,
         draggedElement: false,
         coveredElement: false,
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
               { uid: 'C:42', client: 'mysql', connectionStatus: 'connected', tabs: [] }
            ],
            selectedWorkspace: 'C:42',
            ...(stateOverrides.workspaces as Record<string, unknown> ?? {})
         }
      },
      stubActions: true,
      global: {
         stubs: {
            Draggable: DraggableStub,
            BaseIcon: true,
            SettingBarConnections: true,
            SettingBarContext: true,
            ContextMenu: ContextMenuStub,
            ContextMenuTrigger: ContextMenuTriggerStub
         },
         directives: { tooltip: () => {} }
      }
   });
};

describe('SettingBarConnectionsFolder', () => {
   it('mounts without throwing under default props', () => {
      expect(() => mountFolder()).not.toThrow();
   });

   it('renders the .settingbar-element.folder root', () => {
      const wrapper = mountFolder();
      expect(wrapper.find('.settingbar-element.folder').exists()).toBe(true);
   });

   it('emits folder-sort once on mount (template-level emit at end of setup)', async () => {
      const wrapper = mountFolder();
      await flushPromises();
      // The SFC ends with a synchronous `emit('folder-sort')`
      expect(wrapper.emitted('folder-sort')).toBeTruthy();
      expect(wrapper.emitted('folder-sort')!.length).toBe(1);
   });

   it('renders one nested item per connection in the folder', () => {
      const wrapper = mountFolder();
      const items = wrapper.findAll('.folder-element');
      expect(items.length).toBe(2);
   });

   it('clicking a folder element emits select-workspace with that uid', async () => {
      const wrapper = mountFolder();
      const first = wrapper.find('.folder-element');
      await first.trigger('click');
      const evt = wrapper.emitted('select-workspace');
      expect(evt).toBeTruthy();
      expect(evt![0]).toEqual(['C:42']);
   });

   it('starts closed when localStorage["opened-folders"] does not include uid', () => {
      // beforeEach in setup.ts clears localStorage → starts closed.
      const wrapper = mountFolder();
      // Closed view: folder-overlay (the open trigger) is rendered.
      expect(wrapper.find('.folder-overlay').exists()).toBe(true);
      expect(wrapper.find('.folder-icon').exists()).toBe(false);
   });

   it('clicking the .folder-overlay opens the folder and persists the uid', async () => {
      const wrapper = mountFolder();
      await wrapper.find('.folder-overlay').trigger('click');
      // After open: overlay disappears, folder-icon shows
      expect(wrapper.find('.folder-overlay').exists()).toBe(false);
      expect(wrapper.find('.folder-icon').exists()).toBe(true);
      // localStorage persisted
      const stored = JSON.parse(localStorage.getItem('opened-folders') || '[]');
      expect(stored).toContain('F:1');
   });

   it('clicking the .folder-icon (when open) closes the folder and removes uid', async () => {
      // Pre-seed open state via localStorage
      localStorage.setItem('opened-folders', JSON.stringify(['F:1']));
      const wrapper = mountFolder();
      // Icon is visible (open)
      const icon = wrapper.find('.folder-icon');
      expect(icon.exists()).toBe(true);
      await icon.trigger('click');
      // After close: overlay re-appears
      expect(wrapper.find('.folder-overlay').exists()).toBe(true);
      const stored = JSON.parse(localStorage.getItem('opened-folders') || '[]');
      expect(stored).not.toContain('F:1');
   });

   it('Draggable @start emits folder-drag(true)', async () => {
      const wrapper = mountFolder();
      const draggable = wrapper.findComponent({ name: 'Draggable' });
      expect(draggable.exists()).toBe(true);
      draggable.vm.$emit('start');
      await flushPromises();
      const evt = wrapper.emitted('folder-drag');
      expect(evt).toBeTruthy();
      expect(evt!.at(-1)).toEqual([true]);
   });

   it('Draggable @end emits folder-drag(false)', async () => {
      const wrapper = mountFolder();
      const draggable = wrapper.findComponent({ name: 'Draggable' });
      expect(draggable.exists()).toBe(true);
      draggable.vm.$emit('end');
      await flushPromises();
      const evt = wrapper.emitted('folder-drag');
      expect(evt).toBeTruthy();
      expect(evt!.at(-1)).toEqual([false]);
   });

   it('renders the drop-area SettingBarConnections only when an external connection is being dragged', () => {
      const wrapper = mountFolder({ draggedElement: 'C:99' });
      // SettingBarConnections is stubbed → appears as -stub element.
      expect(wrapper.html()).toContain('setting-bar-connections-stub');
   });

   it('does NOT render the drop-area when draggedElement matches a folder uid', () => {
      // Folder uid is in connectionsOrder, so foldersUid includes it.
      const wrapper = mountFolder({ draggedElement: 'F:1' });
      expect(wrapper.html()).not.toContain('setting-bar-connections-stub');
   });

   it('selected-inside class flips on when the selected workspace is one of folder.connections', () => {
      const wrapper = mountFolder({}, {});
      expect(wrapper.find('.settingbar-element.folder').classes()).toContain('selected-inside');
   });

   it('selected-inside class is dropped when folder is open', async () => {
      localStorage.setItem('opened-folders', JSON.stringify(['F:1']));
      const wrapper = mountFolder();
      await flushPromises();
      // Open + selected-inside → class is gated off in the SFC
      expect(wrapper.find('.settingbar-element.folder').classes()).not.toContain('selected-inside');
   });

   it('uses the folder.color as inline background style on the .folder-container', () => {
      const wrapper = mountFolder();
      const container = wrapper.find('.folder-container');
      expect(container.exists()).toBe(true);
      const style = container.attributes('style') ?? '';
      // Vue serializes `#FF5000` as either '#FF5000' or 'rgb(...)' — both pass.
      expect(style.toLowerCase()).toMatch(/ff5000|rgb\(255,\s*80,\s*0\)/);
   });

   it('cleans up on unmount without throwing (smoke)', () => {
      const wrapper = mountFolder();
      expect(() => wrapper.unmount()).not.toThrow();
   });
});
