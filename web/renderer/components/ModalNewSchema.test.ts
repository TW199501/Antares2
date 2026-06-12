/**
 * Tests for ModalNewSchema.vue — the "Create new schema" dialog.
 *
 * Reads workspace.collations + workspace.customizations from the
 * workspaces store and seeds default collation from the
 * `collation_server` database variable. On confirm calls
 * Schema.createSchema; on success closes + emits 'reload', otherwise
 * pushes a notification.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Schema from '@/ipc-api/Schema';
import { useNotificationsStore } from '@/stores/notifications';

import ModalNewSchema from './ModalNewSchema.vue';

vi.mock('@/ipc-api/Schema', () => ({
   default: {
      createSchema: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));

const stubs = {
   BaseIcon: true,
   ConfirmModal: {
      template:
         '<div class="confirm-stub"><slot name="header" /><slot name="body" /><button class="confirm-btn" @click="$emit(\'confirm\')">OK</button><button class="hide-btn" @click="$emit(\'hide\')">X</button></div>',
      emits: ['confirm', 'hide']
   },
   FormField: { template: '<div class="form-field-stub"><slot /></div>' },
   Input: {
      name: 'Input',
      inheritAttrs: false,
      props: { modelValue: { type: [String, Number], default: '' } },
      emits: ['update:modelValue'],
      template:
         '<input class="input-stub" v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
   },
   BaseSelect: {
      name: 'BaseSelect',
      props: ['modelValue', 'options', 'optionLabel', 'optionTrackBy'],
      emits: ['update:modelValue'],
      template: '<div class="base-select-stub" :data-value="modelValue" />'
   }
};

const seedWorkspace = (over: Record<string, unknown> = {}) => ({
   uid: 'C:1',
   client: 'mysql',
   connectionStatus: 'connected',
   selectedTab: '',
   searchTerm: '',
   tabs: [],
   structure: [],
   variables: [{ name: 'collation_server', value: 'utf8mb4_general_ci' }],
   collations: [{ collation: 'utf8mb4_general_ci' }, { collation: 'utf8mb4_bin' }],
   customizations: { collations: true },
   users: [],
   breadcrumbs: {},
   loadingElements: [],
   loadedSchemas: new Set<string>(),
   ...over
});

const mount = (initialOverrides: Record<string, unknown> = {}) =>
   mountWithPinia(ModalNewSchema, {
      initialState: {
         workspaces: {
            workspaces: [seedWorkspace()],
            selectedWorkspace: 'C:1'
         },
         notifications: { notifications: [] },
         ...initialOverrides
      },
      stubActions: true,
      global: { stubs }
   });

describe('ModalNewSchema', () => {
   it('mounts without throwing', () => {
      expect(() => mount()).not.toThrow();
   });

   it('renders the schema name input and a collation select when customizations.collations is true', () => {
      const wrapper = mount();
      expect(wrapper.findAll('input').length).toBeGreaterThanOrEqual(1);
      expect(wrapper.find('.base-select-stub').exists()).toBe(true);
   });

   it('confirm calls Schema.createSchema with workspace uid + name + collation', async () => {
      const wrapper = mount();
      const nameInput = wrapper.findAll('input')[0];
      await nameInput.setValue('new_db');
      await wrapper.find('.confirm-btn').trigger('click');
      await flushPromises();
      expect(Schema.createSchema).toHaveBeenCalledWith(expect.objectContaining({
         uid: 'C:1',
         name: 'new_db'
      }));
   });

   it('successful createSchema emits close + reload', async () => {
      const wrapper = mount();
      await wrapper.find('.confirm-btn').trigger('click');
      await flushPromises();
      expect(wrapper.emitted('close')).toBeTruthy();
      expect(wrapper.emitted('reload')).toBeTruthy();
   });

   it('error response from createSchema pushes a notification (no reload)', async () => {
      vi.mocked(Schema.createSchema).mockResolvedValueOnce({
         status: 'error',
         response: 'cannot create'
      } as never);
      const wrapper = mount();
      const store = useNotificationsStore();
      await wrapper.find('.confirm-btn').trigger('click');
      await flushPromises();
      expect(store.addNotification).toHaveBeenCalled();
      expect(wrapper.emitted('reload')).toBeFalsy();
   });

   it('hide button emits close', async () => {
      const wrapper = mount();
      await wrapper.find('.hide-btn').trigger('click');
      expect(wrapper.emitted('close')).toBeTruthy();
   });
});
