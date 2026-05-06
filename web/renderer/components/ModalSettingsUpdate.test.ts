/**
 * Tests for ModalSettingsUpdate.vue — the "Updates" tab content of the
 * settings modal. Reads from the application store (updateStatus +
 * getDownloadProgress) and the settings store (allowPrerelease) via
 * storeToRefs, and dispatches:
 *   - checkForUpdates() action when the primary button is clicked under
 *     status in {noupdate, checking, nocheck}
 *   - installUpdate() action under status='downloaded' (Restart-to-install)
 *   - openOutside('https://github.com/...releases/latest') under status='link'
 *   - changeAllowPrerelease(bool) when the prerelease Switch flips
 *
 * Strategy:
 *   - mount via mountWithPinia, seed both store states
 *   - stub Button / Switch / Label as passthroughs so we can probe the
 *     visible primary button by status
 *   - mock @tauri-apps/plugin-shell so openOutside doesn't reach Tauri
 */
import { open as _shellOpen } from '@tauri-apps/plugin-shell';
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ModalSettingsUpdate from './ModalSettingsUpdate.vue';

vi.mock('@tauri-apps/plugin-shell', () => ({
   open: vi.fn(async () => undefined)
}));

const ButtonStub = {
   name: 'Button',
   inheritAttrs: false,
   props: { disabled: { type: Boolean, default: false } },
   template: '<button type="button" class="btn-stub" :disabled="disabled" v-bind="$attrs"><slot /></button>'
};

const SwitchStub = {
   name: 'Switch',
   inheritAttrs: false,
   props: { checked: { type: Boolean, default: false } },
   emits: ['update:checked'],
   template: '<button type="button" class="switch-stub" :data-checked="String(checked)" v-bind="$attrs" @click="$emit(\'update:checked\', !checked)" />'
};

const LabelStub = { template: '<label class="label-stub" v-bind="$attrs"><slot /></label>' };

const mountWith = (
   appOverrides: Record<string, unknown> = {},
   settingsOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(ModalSettingsUpdate, {
      initialState: {
         application: {
            updateStatus: 'noupdate',
            downloadProgress: 0,
            ...appOverrides
         },
         settings: {
            allowPrerelease: false,
            ...settingsOverrides
         }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            Button: ButtonStub,
            Switch: SwitchStub,
            Label: LabelStub
         }
      }
   });
};

afterEach(() => {
   vi.clearAllMocks();
});

describe('ModalSettingsUpdate', () => {
   it('mounts without throwing under the default (noupdate) status', () => {
      expect(() => mountWith()).not.toThrow();
   });

   it('renders the noUpdatesAvailable label under status=noupdate', () => {
      const wrapper = mountWith();
      expect(wrapper.html()).toContain('application.noUpdatesAvailable');
      // Primary button shows "Check for updates"
      expect(wrapper.html()).toContain('application.checkForUpdates');
   });

   it('renders the checkingForUpdate label under status=checking + disables button', () => {
      const wrapper = mountWith({ updateStatus: 'checking' });
      expect(wrapper.html()).toContain('application.checkingForUpdate');
      const btn = wrapper.find('.btn-stub');
      expect(btn.attributes('disabled')).toBeDefined();
   });

   it('renders the checkFailure label under status=nocheck', () => {
      const wrapper = mountWith({ updateStatus: 'nocheck' });
      expect(wrapper.html()).toContain('application.checkFailure');
   });

   it('renders the updateAvailable label + indeterminate progress bar under status=available', () => {
      const wrapper = mountWith({ updateStatus: 'available' });
      expect(wrapper.html()).toContain('application.updateAvailable');
      // Indeterminate <progress> bar (no value attribute)
      expect(wrapper.find('progress').exists()).toBe(true);
   });

   it('renders the downloadingUpdate label + percentage under status=downloading', () => {
      const wrapper = mountWith({ updateStatus: 'downloading', downloadProgress: 42.5 });
      expect(wrapper.html()).toContain('application.downloadingUpdate');
      const progress = wrapper.find('progress');
      expect(progress.exists()).toBe(true);
      // getDownloadProgress getter rounds via toFixed(1) -> 42.5
      expect(progress.attributes('value')).toBe('42.5');
   });

   it('renders restartToInstall button under status=downloaded', () => {
      const wrapper = mountWith({ updateStatus: 'downloaded' });
      expect(wrapper.html()).toContain('application.updateDownloaded');
      expect(wrapper.html()).toContain('application.restartToInstall');
   });

   it('renders goToDownloadPage button under status=link', () => {
      const wrapper = mountWith({ updateStatus: 'link' });
      expect(wrapper.html()).toContain('application.goToDownloadPage');
   });

   it('clicking the check button calls checkForUpdates on the application store', async () => {
      const wrapper = mountWith();
      const { useApplicationStore } = await import('@/stores/application');
      const store = useApplicationStore();
      await wrapper.find('.btn-stub').trigger('click');
      expect(store.checkForUpdates).toHaveBeenCalled();
   });

   it('clicking restartToInstall calls installUpdate on the application store', async () => {
      const wrapper = mountWith({ updateStatus: 'downloaded' });
      const { useApplicationStore } = await import('@/stores/application');
      const store = useApplicationStore();
      await wrapper.find('.btn-stub').trigger('click');
      expect(store.installUpdate).toHaveBeenCalled();
   });

   it('clicking goToDownloadPage calls @tauri-apps/plugin-shell open() with the GH releases URL', async () => {
      const wrapper = mountWith({ updateStatus: 'link' });
      await wrapper.find('.btn-stub').trigger('click');
      expect(_shellOpen).toHaveBeenCalledWith(
         'https://github.com/TW199501/Antares2/releases/latest'
      );
   });

   it('clicking the prerelease Switch calls changeAllowPrerelease(true)', async () => {
      const wrapper = mountWith({}, { allowPrerelease: false });
      const { useSettingsStore } = await import('@/stores/settings');
      const store = useSettingsStore();
      const sw = wrapper.find('.switch-stub');
      expect(sw.attributes('data-checked')).toBe('false');
      await sw.trigger('click');
      expect(store.changeAllowPrerelease).toHaveBeenCalledWith(true);
   });

   it('Switch reflects the seeded allowPrerelease=true state', () => {
      const wrapper = mountWith({}, { allowPrerelease: true });
      const sw = wrapper.find('.switch-stub');
      expect(sw.attributes('data-checked')).toBe('true');
   });

   it('exports the component as an SFC object', () => {
      expect(ModalSettingsUpdate).toBeDefined();
      expect(typeof ModalSettingsUpdate).toBe('object');
   });
});
