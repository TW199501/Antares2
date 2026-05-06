/**
 * Tests for ModalEditSchema.vue — edit dialog for an existing database
 * (schema). On mount it calls Schema.getDatabaseCollation to populate the
 * actual collation. On confirm it diffs collation vs prev and either calls
 * Schema.updateSchema or short-circuits to closeModal.
 *
 * Workspaces store provides getWorkspace().collations and
 * getDatabaseVariable() for the server default. We seed both.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import Schema from '@/ipc-api/Schema';
import { useNotificationsStore } from '@/stores/notifications';

import ModalEditSchema from './ModalEditSchema.vue';

vi.mock('@/ipc-api/Schema', () => ({
   default: {
      getDatabaseCollation: vi.fn().mockResolvedValue({ status: 'success', response: 'utf8mb4_bin' }),
      updateSchema: vi.fn().mockResolvedValue({ status: 'success', response: null })
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

const seedWorkspace = (collation = 'utf8mb4_general_ci') => ({
   uid: 'C:1',
   client: 'mysql',
   connectionStatus: 'connected',
   selectedTab: '',
   searchTerm: '',
   tabs: [],
   structure: [],
   variables: [{ name: 'collation_server', value: collation }],
   collations: [{ collation: 'utf8mb4_general_ci' }, { collation: 'utf8mb4_bin' }],
   users: [],
   breadcrumbs: {},
   loadingElements: [],
   loadedSchemas: new Set<string>()
});

const mount = (initialStateOverrides: Record<string, unknown> = {}) =>
   mountWithPinia(ModalEditSchema, {
      props: {
         selectedSchema: 'app'
      } as never,
      initialState: {
         workspaces: {
            workspaces: [seedWorkspace()],
            selectedWorkspace: 'C:1'
         },
         notifications: { notifications: [] },
         ...initialStateOverrides
      },
      stubActions: true,
      global: { stubs }
   });

describe('ModalEditSchema', () => {
   it('mounts without throwing', () => {
      expect(() => mount()).not.toThrow();
   });

   it('calls Schema.getDatabaseCollation on mount with workspace uid + database', async () => {
      mount();
      await flushPromises();
      expect(Schema.getDatabaseCollation).toHaveBeenCalledWith({ uid: 'C:1', database: 'app' });
   });

   it('confirm with unchanged collation does NOT call updateSchema (short-circuit)', async () => {
      const wrapper = mount();
      await flushPromises();
      await wrapper.find('.confirm-btn').trigger('click');
      await flushPromises();
      expect(Schema.updateSchema).not.toHaveBeenCalled();
      expect(wrapper.emitted('close')).toBeTruthy();
   });

   it('hide button emits close', async () => {
      const wrapper = mount();
      await flushPromises();
      await wrapper.find('.hide-btn').trigger('click');
      expect(wrapper.emitted('close')).toBeTruthy();
   });

   it('error response from getDatabaseCollation pushes a notification', async () => {
      vi.mocked(Schema.getDatabaseCollation).mockResolvedValueOnce({
         status: 'error',
         response: 'denied'
      } as never);
      mount();
      const store = useNotificationsStore();
      await flushPromises();
      expect(store.addNotification).toHaveBeenCalled();
   });
});
