/**
 * Tests for TheSettingBar — left-edge sidebar with connection list,
 * "add connection" button, scratchpad / inspector / settings shortcuts.
 *
 * The component pulls 3 stores (application / connections / workspaces) and
 * uses floating-vue's `v-tooltip` directive plus a child SettingBarConnections.
 * We stub the directive and the child to keep the test lightweight, then
 * assert: mount, root id, sidebar action wiring (settings cog calls
 * applicationStore.showSettingModal('general')), specsnap toggle,
 * "+ new connection" click selects 'NEW'.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { describe, expect, it } from 'vitest';

import { useApplicationStore } from '@/stores/application';
import { useWorkspacesStore } from '@/stores/workspaces';

import TheSettingBar from './TheSettingBar.vue';

const mountSettingBar = (initialState: Record<string, unknown> = {}) =>
   mountWithPinia(TheSettingBar, {
      initialState,
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            SettingBarConnections: true
         },
         directives: {
            tooltip: () => {}
         }
      }
   });

describe('TheSettingBar', () => {
   it('mounts without throwing under default state', () => {
      expect(() => mountSettingBar()).not.toThrow();
   });

   it('renders the #settingbar root element', () => {
      const wrapper = mountSettingBar();
      expect(wrapper.find('#settingbar').exists()).toBe(true);
   });

   it('renders SettingBarConnections in the top section', () => {
      const wrapper = mountSettingBar();
      // Stubbed component appears as <setting-bar-connections-stub>
      expect(wrapper.html()).toContain('setting-bar-connections-stub');
   });

   it('renders the "+ new connection" button (selects NEW workspace)', async () => {
      const wrapper = mountSettingBar();
      // The middle section contains the "add" button (+ icon)
      const addButton = wrapper.find('.settingbar-middle-elements .settingbar-element');
      expect(addButton.exists()).toBe(true);

      const workspacesStore = useWorkspacesStore();
      await addButton.trigger('click');
      expect(workspacesStore.selectWorkspace).toHaveBeenCalledWith('NEW');
   });

   it('clicking the specsnap (crosshair) entry calls showSpecsnap', async () => {
      const wrapper = mountSettingBar();
      const bottom = wrapper.find('.settingbar-bottom-elements');
      // The specsnap icon is the first li in the bottom section
      const specsnapLi = bottom.findAll('.settingbar-element')[0];
      expect(specsnapLi.exists()).toBe(true);

      const applicationStore = useApplicationStore();
      await specsnapLi.trigger('click');
      expect(applicationStore.showSpecsnap).toHaveBeenCalled();
   });

   it('clicking the scratchpad (notebook) entry calls showScratchpad', async () => {
      const wrapper = mountSettingBar();
      const bottom = wrapper.find('.settingbar-bottom-elements');
      const scratchpadLi = bottom.findAll('.settingbar-element')[1];
      expect(scratchpadLi.exists()).toBe(true);

      const applicationStore = useApplicationStore();
      await scratchpadLi.trigger('click');
      expect(applicationStore.showScratchpad).toHaveBeenCalled();
   });

   it('clicking the cog (settings) entry calls showSettingModal("general")', async () => {
      const wrapper = mountSettingBar();
      const bottom = wrapper.find('.settingbar-bottom-elements');
      const cogLi = bottom.findAll('.settingbar-element')[2];
      expect(cogLi.exists()).toBe(true);

      const applicationStore = useApplicationStore();
      await cogLi.trigger('click');
      expect(applicationStore.showSettingModal).toHaveBeenCalledWith('general');
   });
});
