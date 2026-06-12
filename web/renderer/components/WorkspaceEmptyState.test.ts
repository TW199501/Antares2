/**
 * Smoke tests for WorkspaceEmptyState.vue — full-bleed placeholder shown
 * when a connection is open but no tabs exist yet. Renders an app logo,
 * an i18n "no open tabs" caption, and a "new tab" button that emits
 * `new-tab` upward.
 *
 * Component pulls the selected workspace from useWorkspacesStore and
 * calls `changeBreadcrumbs` synchronously during script-setup. Tests use
 * `mountWithPinia` with stubActions: true so the action is a no-op spy
 * and a seeded workspace so `workspace.value.breadcrumbs.schema` resolves.
 *
 * Locked contracts:
 *   - is exported / defined
 *   - mounts without throwing with a seeded selected workspace
 *   - renders the logo <img>, the i18n caption, and a Button
 *   - clicking the button emits `new-tab`
 *   - `changeBreadcrumbs` action is invoked once on mount
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { describe, expect, it } from 'vitest';

import { useWorkspacesStore } from '@/stores/workspaces';

import WorkspaceEmptyState from './WorkspaceEmptyState.vue';

const seededWorkspace = {
   uid: 'C:1',
   client: 'mysql',
   database: 'app',
   connectionStatus: 'connected',
   tabs: [],
   selectedTab: null,
   structure: [],
   breadcrumbs: { schema: 'app' },
   loadedSchemas: new Set(),
   customizations: {}
};

const mountState = () =>
   mountWithPinia(WorkspaceEmptyState, {
      initialState: {
         workspaces: {
            workspaces: [seededWorkspace],
            selectedWorkspace: 'C:1'
         }
      },
      stubActions: true
   });

describe('WorkspaceEmptyState', () => {
   it('is exported and defined', () => {
      expect(WorkspaceEmptyState).toBeDefined();
   });

   it('mounts without throwing under a seeded workspace', () => {
      expect(() => mountState()).not.toThrow();
   });

   it('renders the app logo image and the i18n caption', () => {
      const wrapper = mountState();
      expect(wrapper.find('img').exists()).toBe(true);
      expect(wrapper.html()).toContain('application.noOpenTabs');
   });

   it('emits `new-tab` when the action button is clicked', async () => {
      const wrapper = mountState();
      const button = wrapper.find('button');
      expect(button.exists()).toBe(true);
      await button.trigger('click');
      expect(wrapper.emitted('new-tab')).toBeTruthy();
      expect(wrapper.emitted('new-tab')!.length).toBe(1);
   });

   it('calls `changeBreadcrumbs` on mount with the workspace schema', () => {
      const wrapper = mountState();
      const store = useWorkspacesStore();
      // stubActions: true wraps each action as a vi.fn spy
      expect(store.changeBreadcrumbs).toHaveBeenCalledTimes(1);
      expect(store.changeBreadcrumbs).toHaveBeenCalledWith({ schema: 'app' });
      wrapper.unmount();
   });
});
