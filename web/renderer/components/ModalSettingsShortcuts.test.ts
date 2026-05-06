/**
 * Tests for ModalSettingsShortcuts.vue — shortcut-manager tab content.
 *
 * Component shape:
 *   - Reads settings store -> shortcuts (ShortcutRecord[])
 *   - useFilters().parseKeys produces kbd HTML
 *   - 4 ConfirmModal instances (Add / Edit / Delete / RestoreDefaults), each
 *     v-if-gated by isConfirm{Add,Edit,Delete,Restore}Modal refs
 *   - eventOptions computed from shortcutEvents map
 *   - Application.updateShortcuts / restoreDefaultShortcuts called on confirm
 *   - watch(typedShortcut) sets doesShortcutExists for collision detection
 *
 * Strategy:
 *   - Stub ConfirmModal as a slot-passthrough shell with confirm/hide buttons
 *   - Stub Button / Label / BaseSelect / KeyPressDetector / BaseIcon
 *   - Mock @/ipc-api/Application static methods so confirm flows don't reach
 *     the real httpClient (tests/setup.ts already mocks httpClient itself,
 *     but Application still calls Tauri APIs in a few methods)
 *   - Seed settings.shortcuts with two records to exercise list rendering
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ModalSettingsShortcuts from './ModalSettingsShortcuts.vue';

vi.mock('@/ipc-api/Application', () => ({
   default: {
      updateShortcuts: vi.fn().mockResolvedValue(undefined),
      restoreDefaultShortcuts: vi.fn().mockResolvedValue(undefined),
      reloadShortcuts: vi.fn().mockResolvedValue(undefined),
      unregisterShortcuts: vi.fn().mockResolvedValue(undefined)
   }
}));

const seedShortcuts = () => [
   { event: 'run-or-reload', keys: ['F5'], os: ['win32'] },
   { event: 'open-new-tab', keys: ['CommandOrControl+T'], os: ['win32'] }
];

const ConfirmModalStub = {
   name: 'ConfirmModal',
   inheritAttrs: false,
   emits: ['confirm', 'hide'],
   template: `
      <div class="confirm-modal-stub" v-bind="$attrs">
         <div class="cm-header"><slot name="header" /></div>
         <div data-modal-body class="cm-body"><slot name="body" /></div>
         <button type="button" class="cm-confirm-btn" @click="$emit('confirm')">confirm</button>
         <button type="button" class="cm-hide-btn" @click="$emit('hide')">hide</button>
      </div>
   `
};

const BaseSelectStub = {
   name: 'BaseSelect',
   props: { modelValue: { type: [String, Number, Boolean, Object], default: null } },
   emits: ['update:modelValue'],
   template: '<div class="select-stub" :data-value="String(modelValue)" />'
};

const KeyPressDetectorStub = {
   name: 'KeyPressDetector',
   props: { modelValue: { type: String, default: '' } },
   emits: ['update:modelValue'],
   template: '<div class="keypress-stub" :data-value="modelValue" />'
};

const ButtonStub = {
   name: 'Button',
   inheritAttrs: false,
   props: { variant: { type: String, default: 'default' }, size: { type: String, default: 'default' } },
   template: '<button type="button" class="btn-stub" :data-variant="variant" v-bind="$attrs"><slot /></button>'
};

const mountModal = (
   settingsOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(ModalSettingsShortcuts, {
      initialState: {
         settings: {
            shortcuts: seedShortcuts(),
            ...settingsOverrides
         }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            BaseSelect: BaseSelectStub,
            ConfirmModal: ConfirmModalStub,
            KeyPressDetector: KeyPressDetectorStub,
            Button: ButtonStub,
            Label: { template: '<label class="label-stub" v-bind="$attrs"><slot /></label>' }
         }
      }
   });
};

afterEach(() => {
   vi.clearAllMocks();
});

describe('ModalSettingsShortcuts', () => {
   it('mounts without throwing under a 2-shortcut seed', async () => {
      expect(() => mountModal()).not.toThrow();
      await flushPromises();
   });

   it('renders one row per shortcut from settings.shortcuts', async () => {
      const wrapper = mountModal();
      await flushPromises();
      // Each data row uses class="group ..."; header row is separate (no .group).
      const rows = wrapper.findAll('div.group.grid');
      expect(rows.length).toBe(2);
      expect(wrapper.html()).toContain('application.runOrReload');
      expect(wrapper.html()).toContain('application.openNewTab');
   });

   it('renders nothing in the row list when settings.shortcuts is empty', async () => {
      const wrapper = mountModal({ shortcuts: [] });
      await flushPromises();
      expect(wrapper.findAll('div.group.grid').length).toBe(0);
   });

   it('clicking the toolbar Add button mounts the Add ConfirmModal', async () => {
      const wrapper = mountModal();
      await flushPromises();
      // Initially: 0 ConfirmModal instances (all v-if false)
      expect(wrapper.findAll('.confirm-modal-stub').length).toBe(0);
      const addBtn = wrapper.findAll('.btn-stub').find(b => b.text().includes('application.addShortcut'));
      expect(addBtn).toBeTruthy();
      await addBtn!.trigger('click');
      await flushPromises();
      // Add modal is now in DOM
      expect(wrapper.findAll('.confirm-modal-stub').length).toBe(1);
   });

   it('clicking Restore Defaults toolbar button opens the Restore confirm', async () => {
      const wrapper = mountModal();
      await flushPromises();
      const restoreBtn = wrapper.findAll('.btn-stub').find(b => b.text().includes('application.restoreDefaults'));
      expect(restoreBtn).toBeTruthy();
      await restoreBtn!.trigger('click');
      await flushPromises();
      expect(wrapper.findAll('.confirm-modal-stub').length).toBe(1);
      expect(wrapper.html()).toContain('application.restoreDefaultsQuestion');
   });

   it('confirming Restore Defaults invokes Application.restoreDefaultShortcuts and closes the modal', async () => {
      const Application = (await import('@/ipc-api/Application')).default;
      const wrapper = mountModal();
      await flushPromises();
      const restoreBtn = wrapper.findAll('.btn-stub').find(b => b.text().includes('application.restoreDefaults'));
      await restoreBtn!.trigger('click');
      await flushPromises();
      await wrapper.find('.cm-confirm-btn').trigger('click');
      await flushPromises();
      expect(Application.restoreDefaultShortcuts).toHaveBeenCalledTimes(1);
      // Confirm closes the modal -> stub instance count drops to 0
      expect(wrapper.findAll('.confirm-modal-stub').length).toBe(0);
   });

   it('per-row Edit button opens the Edit ConfirmModal', async () => {
      const wrapper = mountModal();
      await flushPromises();
      const editBtn = wrapper.findAll('.btn-stub').find(b => b.text().includes('general.edit'));
      expect(editBtn).toBeTruthy();
      await editBtn!.trigger('click');
      await flushPromises();
      expect(wrapper.findAll('.confirm-modal-stub').length).toBe(1);
      expect(wrapper.html()).toContain('application.editShortcut');
   });

   it('per-row Delete button opens the Delete ConfirmModal and confirm calls updateShortcuts', async () => {
      const Application = (await import('@/ipc-api/Application')).default;
      const wrapper = mountModal();
      await flushPromises();
      const deleteBtn = wrapper.findAll('.btn-stub').find(b => b.text().includes('general.delete'));
      expect(deleteBtn).toBeTruthy();
      await deleteBtn!.trigger('click');
      await flushPromises();
      expect(wrapper.html()).toContain('application.deleteShortcut');
      // Confirm -> updateShortcuts called with the filtered list (one fewer)
      await wrapper.find('.cm-confirm-btn').trigger('click');
      await flushPromises();
      expect(Application.updateShortcuts).toHaveBeenCalledTimes(1);
   });

   it('hide event on the Add ConfirmModal closes it (resetting state)', async () => {
      const wrapper = mountModal();
      await flushPromises();
      const addBtn = wrapper.findAll('.btn-stub').find(b => b.text().includes('application.addShortcut'));
      await addBtn!.trigger('click');
      await flushPromises();
      expect(wrapper.findAll('.confirm-modal-stub').length).toBe(1);
      await wrapper.find('.cm-hide-btn').trigger('click');
      await flushPromises();
      expect(wrapper.findAll('.confirm-modal-stub').length).toBe(0);
   });
});
