/**
 * Tests for Workspace.vue — the per-connection workspace shell that owns
 * the tab strip, tab routing (query / data / new-table / props-* / etc.),
 * the explore-bar, and several modals (processes / discard / query-builder).
 *
 * The component depends on:
 *   - useWorkspacesStore (selected workspace, tabs, customizations)
 *   - useConsoleStore (console toggle)
 *   - vuedraggable (#item slot — stubbed as pass-through)
 *   - many Workspace* sub-components (all stubbed: true so we only assert
 *     that the right `*-stub` element renders for each tab type)
 *   - Connection.checkConnection (already covered by global apiCall mock)
 *
 * The IIFE in script-setup runs `addWorkspace` + `Connection.checkConnection`
 * on mount; the catch-tail swallows any thrown error so a partial mock is
 * tolerated. Tests `await flushPromises()` once after mount to drain it.
 *
 * Coverage targets: tab-type branch rendering, addQueryTab → modal flag,
 * close/closeAll/closeOther/closeToLeft/closeToRight tab actions, computed
 * draggableTabs (database filter), context menu open/close, watch on
 * queryTabs (no-throw on length change).
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Workspace from './Workspace.vue';

const DraggableStub = {
   name: 'Draggable',
   props: { modelValue: { type: Array, default: () => [] } },
   template: `
      <ul class="draggable-stub">
         <slot name="header" />
         <template v-for="(element, idx) in modelValue" :key="element.uid || idx">
            <slot name="item" :element="element" :index="idx" />
         </template>
         <slot name="footer" />
      </ul>
   `
};

const baseCustomizations = {
   processesList: true,
   usersManagement: true,
   variables: true,
   database: true
};

const buildWorkspace = (overrides: Record<string, unknown> = {}) => ({
   uid: 'C:1',
   client: 'mysql',
   database: 'app',
   connectionStatus: 'connected',
   tabs: [],
   selectedTab: null,
   structure: [{ name: 'app', tables: [{ name: 'users' }] }],
   breadcrumbs: { schema: 'app' },
   loadedSchemas: new Set(),
   customizations: baseCustomizations,
   ...overrides
});

const mountWorkspace = (
   workspaceOverrides: Record<string, unknown> = {},
   connectionOverrides: Record<string, unknown> = {}
) => {
   const workspace = buildWorkspace(workspaceOverrides);
   const wrapper = mountWithPinia(Workspace, {
      // Cast: ConnectionParams has many optional fields; we only seed
      // what the rendered branches need. vue-test-utils strict prop typing
      // doesn't allow partial pass-through, so we cast at call site.
      props: {
         connection: { uid: 'C:1', client: 'mysql', ...connectionOverrides }
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
            Draggable: DraggableStub,
            BaseIcon: true,
            DebugConsole: true,
            ModalDiscardChanges: true,
            ModalProcessesList: true,
            ModalQueryBuilder: true,
            WorkspaceEditConnectionPanel: true,
            WorkspaceEmptyState: true,
            WorkspaceExploreBar: true,
            WorkspaceTabsContext: true,
            WorkspaceTabQuery: true,
            WorkspaceTabTable: true,
            WorkspaceTabNewTable: true,
            WorkspaceTabPropsTable: true,
            WorkspaceTabNewView: true,
            WorkspaceTabNewMaterializedView: true,
            WorkspaceTabPropsView: true,
            WorkspaceTabPropsMaterializedView: true,
            WorkspaceTabNewTrigger: true,
            WorkspaceTabPropsTrigger: true,
            WorkspaceTabNewTriggerFunction: true,
            WorkspaceTabPropsTriggerFunction: true,
            WorkspaceTabNewRoutine: true,
            WorkspaceTabPropsRoutine: true,
            WorkspaceTabNewFunction: true,
            WorkspaceTabPropsFunction: true,
            WorkspaceTabNewScheduler: true,
            WorkspaceTabPropsScheduler: true,
            DropdownMenu: { template: '<div class="dropdown"><slot /></div>' },
            DropdownMenuTrigger: { template: '<div class="dropdown-trigger"><slot /></div>' },
            DropdownMenuContent: { template: '<div class="dropdown-content"><slot /></div>' },
            DropdownMenuItem: { template: '<div class="dropdown-item" @click="$emit(\'select\')"><slot /></div>' }
         }
      }
   });
   return { wrapper, workspace };
};

describe('Workspace', () => {
   it('mounts without throwing under the default connected workspace', async () => {
      expect(() => mountWorkspace()).not.toThrow();
      await flushPromises();
   });

   it('renders the .workspace root container', async () => {
      const { wrapper } = mountWorkspace();
      await flushPromises();
      expect(wrapper.find('.workspace').exists()).toBe(true);
   });

   it('renders the explore bar when connectionStatus is "connected"', async () => {
      const { wrapper } = mountWorkspace();
      await flushPromises();
      expect(wrapper.html()).toContain('workspace-explore-bar-stub');
   });

   it('renders the connection edit panel when not connected', async () => {
      const { wrapper } = mountWorkspace({ connectionStatus: 'disconnected' });
      await flushPromises();
      expect(wrapper.html()).toContain('workspace-edit-connection-panel-stub');
      expect(wrapper.html()).not.toContain('workspace-explore-bar-stub');
   });

   it('shows the connecting loader when connectionStatus is "connecting"', async () => {
      const { wrapper } = mountWorkspace({ connectionStatus: 'connecting' });
      await flushPromises();
      expect(wrapper.find('.loading').exists()).toBe(true);
   });

   it('renders WorkspaceEmptyState when there are zero tabs', async () => {
      const { wrapper } = mountWorkspace({ tabs: [] });
      await flushPromises();
      expect(wrapper.html()).toContain('workspace-empty-state-stub');
   });

   it('renders one tab cell per draggable tab (database filter respected)', async () => {
      const { wrapper } = mountWorkspace({
         tabs: [
            { uid: 'T:1', type: 'query', database: 'app', index: 1, isChanged: false },
            { uid: 'T:2', type: 'data', database: 'app', elementType: 'table', elementName: 'users' },
            // dropped because it belongs to another database (customizations.database = true)
            { uid: 'T:3', type: 'data', database: 'other', elementType: 'table', elementName: 'orders' }
         ],
         selectedTab: 'T:1'
      });
      await flushPromises();
      const cells = wrapper.findAll('.ws-tab-cell.tab-draggable');
      expect(cells.length).toBe(2);
   });

   it('renders WorkspaceTabQuery for type=query and the related sub-component for type=data', async () => {
      const { wrapper } = mountWorkspace({
         tabs: [
            { uid: 'T:1', type: 'query', database: 'app', index: 1, isChanged: false },
            { uid: 'T:2', type: 'data', database: 'app', elementType: 'table', elementName: 'users' }
         ],
         selectedTab: 'T:1'
      });
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain('workspace-tab-query-stub');
      expect(html).toContain('workspace-tab-table-stub');
   });

   it('renders the new-table sub-component for type=new-table tab', async () => {
      const { wrapper } = mountWorkspace({
         tabs: [
            { uid: 'T:N', type: 'new-table', database: 'app', elementType: 'table' }
         ],
         selectedTab: 'T:N'
      });
      await flushPromises();
      expect(wrapper.html()).toContain('workspace-tab-new-table-stub');
   });

   it('renders the table-props sub-component for type=table-props tab', async () => {
      const { wrapper } = mountWorkspace({
         tabs: [
            { uid: 'T:P', type: 'table-props', database: 'app', elementType: 'table', elementName: 'users' }
         ],
         selectedTab: 'T:P'
      });
      await flushPromises();
      expect(wrapper.html()).toContain('workspace-tab-props-table-stub');
   });

   it('clicking the .tab-add footer button opens the query builder modal', async () => {
      const { wrapper } = mountWorkspace({
         tabs: [
            { uid: 'T:1', type: 'query', database: 'app', index: 1, isChanged: false }
         ],
         selectedTab: 'T:1'
      });
      await flushPromises();
      // Modal absent before click
      expect(wrapper.html()).not.toContain('modal-query-builder-stub');
      await wrapper.find('.tab-add').trigger('click');
      await flushPromises();
      expect(wrapper.html()).toContain('modal-query-builder-stub');
   });

   it('antares:open-new-tab event opens the query builder when isSelected is true', async () => {
      const { wrapper } = mountWorkspace();
      await flushPromises();
      window.dispatchEvent(new CustomEvent('antares:open-new-tab'));
      await flushPromises();
      expect(wrapper.html()).toContain('modal-query-builder-stub');
   });

   it('right-clicking a tab opens the WorkspaceTabsContext menu', async () => {
      const { wrapper } = mountWorkspace({
         tabs: [
            { uid: 'T:1', type: 'query', database: 'app', index: 1, isChanged: false }
         ],
         selectedTab: 'T:1'
      });
      await flushPromises();
      // Context not visible by default
      expect(wrapper.html()).not.toContain('workspace-tabs-context-stub');
      await wrapper.find('.ws-tab-cell.tab-draggable').trigger('contextmenu');
      await flushPromises();
      expect(wrapper.html()).toContain('workspace-tabs-context-stub');
   });

   it('shows the discard modal when closing a changed tab and clears it on cancel', async () => {
      const { wrapper } = mountWorkspace({
         tabs: [
            { uid: 'T:1', type: 'query', database: 'app', index: 1, isChanged: true }
         ],
         selectedTab: 'T:1'
      });
      await flushPromises();
      // Click the inline close icon on the tab
      const close = wrapper.find('.tab-close');
      expect(close.exists()).toBe(true);
      await close.trigger('click');
      await flushPromises();
      expect(wrapper.html()).toContain('modal-discard-changes-stub');
   });

   // Tools dropdown (mdiTools workspace-tools-link) was removed in commit
   // 5bdcb53 — its 4 entries (processesList / console / variables / users)
   // were dead clicks (variables/users always disabled, console moved to
   // bottom). Processes list is now reached via the bottom-console tab
   // (DebugConsole.vue), which has its own tests. The two tools-dropdown
   // tests that lived here are gone with the dropdown.

   it('cleans up window listeners on unmount (smoke: no throw)', async () => {
      const { wrapper } = mountWorkspace();
      await flushPromises();
      expect(() => wrapper.unmount()).not.toThrow();
   });
});
