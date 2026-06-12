/**
 * Tests for WorkspaceTabPropsTableIndexesModal.vue — the indexes editor
 * dialog opened from the table-props tab. Owns:
 *   - indexesProxy (deep-cloned localIndexes on mount)
 *   - selectedIndexID with selectedIndexObj computed
 *   - addIndex / removeIndex / clearChanges
 *   - toggleField (add/remove field name on the selected index)
 *   - hasPrimary (PRIMARY / PRIMARY KEY in current proxy)
 *   - confirmIndexesChange filters empty-field indexes + emits 'indexes-update'
 *   - getModalInnerHeight on resize listener
 *
 * The component is purely prop-driven (no IPC at mount). ConfirmModal is
 * stubbed as a slot-passthrough shell that re-emits @confirm / @hide so
 * tests can drive both terminations.
 *
 * Spec §5.A — we don't probe reka-ui internals; ConfirmModal is replaced by
 * a slot-passthrough shell.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import WorkspaceTabPropsTableIndexesModal from './WorkspaceTabPropsTableIndexesModal.vue';

const baseFields = [
   { name: 'id', type: 'INT', comment: 'pk' },
   { name: 'email', type: 'VARCHAR' },
   { name: 'created_at', type: 'TIMESTAMP' }
];

const baseWorkspace = {
   uid: 'C:1',
   client: 'mysql',
   customizations: {
      primaryAsIndex: false
   }
};

const baseIndexTypes = ['PRIMARY', 'INDEX', 'UNIQUE', 'FULLTEXT'];

const seedIndexes = () => [
   {
      _antares_id: 'IDX:1',
      name: 'idx_email',
      type: 'UNIQUE',
      fields: ['email']
   },
   {
      _antares_id: 'IDX:2',
      name: 'idx_created',
      type: 'INDEX',
      fields: ['created_at']
   }
];

// Pass-through shell for BaseConfirmModal. Includes a `.modal-body` element
// because getModalInnerHeight() queries `.modal-body` for its clientHeight.
const ConfirmModalStub = {
   name: 'ConfirmModal',
   inheritAttrs: false,
   emits: ['confirm', 'hide'],
   template: `
      <div class="confirm-modal-stub" v-bind="$attrs">
         <div class="cm-header"><slot name="header" /></div>
         <div class="modal-body cm-body"><slot name="body" /></div>
         <button type="button" class="cm-confirm-btn" @click="$emit('confirm')">confirm</button>
         <button type="button" class="cm-hide-btn" @click="$emit('hide')">hide</button>
      </div>
   `
};

const SelectStub = {
   name: 'BaseSelect',
   props: { modelValue: { type: [String, Number, null] as never, default: null } },
   emits: ['update:modelValue', 'change'],
   template: '<div class="select-stub" :data-value="String(modelValue)" />'
};

const CheckboxStub = {
   name: 'Checkbox',
   props: { modelValue: { type: Boolean, default: false } },
   emits: ['update:modelValue'],
   template: '<button type="button" class="checkbox-stub" :data-checked="String(modelValue)" @click="$emit(\'update:modelValue\', !modelValue)" />'
};

const InputStub = {
   name: 'Input',
   inheritAttrs: false,
   props: { modelValue: { type: [String, Number, null] as never, default: '' } },
   emits: ['update:modelValue'],
   template: '<input class="input-stub" v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', ($event.target as HTMLInputElement).value)" />'
};

const ButtonStub = {
   name: 'Button',
   inheritAttrs: false,
   emits: ['click'],
   template: '<button type="button" class="btn-stub" v-bind="$attrs" @click="$emit(\'click\', $event)"><slot /></button>'
};

const mountModal = (
   propOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(WorkspaceTabPropsTableIndexesModal, {
      props: {
         localIndexes: seedIndexes(),
         table: 'users',
         fields: baseFields,
         workspace: baseWorkspace,
         indexTypes: baseIndexTypes,
         ...propOverrides
      } as never,
      initialState: {
         notifications: { notifications: [] }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            BaseSelect: SelectStub,
            Button: ButtonStub,
            Checkbox: CheckboxStub,
            Input: InputStub,
            Label: { template: '<label class="label-stub" v-bind="$attrs"><slot /></label>' },
            ConfirmModal: ConfirmModalStub
         }
      }
   });
};

describe('WorkspaceTabPropsTableIndexesModal', () => {
   it('exports the component definition', () => {
      expect(WorkspaceTabPropsTableIndexesModal).toBeDefined();
      expect(typeof WorkspaceTabPropsTableIndexesModal).toBe('object');
   });

   it('mounts without throwing under a seeded localIndexes prop', async () => {
      expect(() => mountModal()).not.toThrow();
      await flushPromises();
   });

   it('renders the ConfirmModal shell with header + body slots and table name', async () => {
      const wrapper = mountModal();
      await flushPromises();
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(true);
      expect(wrapper.html()).toContain('database.indexes');
      // Table name appears in the header
      expect(wrapper.html()).toContain('users');
   });

   it('renders one row per index in indexesProxy after mount', async () => {
      const wrapper = mountModal();
      await flushPromises();
      // Both seeded indexes render their name
      expect(wrapper.html()).toContain('idx_email');
      expect(wrapper.html()).toContain('idx_created');
   });

   it('renders the empty-state hint when localIndexes is empty', async () => {
      const wrapper = mountModal({ localIndexes: [] });
      await flushPromises();
      expect(wrapper.html()).toContain('database.thereAreNoIndexes');
      expect(wrapper.html()).toContain('database.createNewIndex');
   });

   it('Clear button is disabled when indexesProxy matches localIndexes (no edits)', async () => {
      const wrapper = mountModal();
      await flushPromises();
      const clearBtn = wrapper.findAll('.btn-stub').find(b => b.text().includes('general.clear'));
      expect(clearBtn).toBeTruthy();
      expect(clearBtn!.attributes('disabled')).toBeDefined();
   });

   it('renders an Add button in the toolbar', async () => {
      const wrapper = mountModal();
      await flushPromises();
      const addBtn = wrapper.findAll('.btn-stub').find(b => b.text().includes('general.add'));
      expect(addBtn).toBeTruthy();
   });

   it('hide event from ConfirmModal forwards as a "hide" emit', async () => {
      const wrapper = mountModal();
      await flushPromises();
      await wrapper.find('.cm-hide-btn').trigger('click');
      await flushPromises();
      expect(wrapper.emitted('hide')).toBeTruthy();
   });
});
