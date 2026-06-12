/**
 * Tests for WorkspaceTabPropsTableOptionsModal.vue — the "Edit Table
 * Options" modal launched from the props table tab. Edits a snapshot of
 * `props.options` and emits 'confirm' with the new payload.
 *
 * Conditional rows are gated by `customizations.{comment, autoIncrement,
 * engines, collations}` — we exercise a few combinations.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { describe, expect, it } from 'vitest';

import WorkspaceTabPropsTableOptionsModal from './WorkspaceTabPropsTableOptionsModal.vue';

const baseOptions = {
   name: 'users',
   comment: 'app users',
   autoIncrement: 100,
   engine: 'InnoDB',
   collation: 'utf8mb4_general_ci'
};

const stubs = {
   BaseIcon: true,
   ConfirmModal: {
      template:
         '<div class="confirm-stub"><slot name="header" /><slot name="body" /><button class="confirm-btn" @click="$emit(\'confirm\')">OK</button><button class="hide-btn" @click="$emit(\'hide\')">X</button></div>',
      emits: ['confirm', 'hide']
   },
   Label: { template: '<label class="label-stub" v-bind="$attrs"><slot /></label>' },
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

const mount = (
   props: Record<string, unknown> = {}
) =>
   mountWithPinia(WorkspaceTabPropsTableOptionsModal, {
      props: {
         options: { ...baseOptions },
         table: 'users',
         customizations: { comment: true, autoIncrement: true, engines: true, collations: true },
         engines: [{ name: 'InnoDB' }, { name: 'MyISAM' }],
         ...props
      } as never,
      global: { stubs }
   });

describe('WorkspaceTabPropsTableOptionsModal', () => {
   it('mounts without throwing under full customizations', () => {
      expect(() => mount()).not.toThrow();
   });

   it('renders inputs for name + comment + autoIncrement when all customizations on', () => {
      const wrapper = mount();
      const inputs = wrapper.findAll('input');
      // name + comment + autoIncrement + collation (readonly)
      expect(inputs.length).toBe(4);
   });

   it('omits comment / autoIncrement / engine / collation rows when customizations are off', () => {
      const wrapper = mount({ customizations: {} });
      const inputs = wrapper.findAll('input');
      expect(inputs.length).toBe(1); // only name
      expect(wrapper.find('.base-select-stub').exists()).toBe(false);
   });

   it('confirm emits the local snapshot with updated name', async () => {
      const wrapper = mount();
      const nameInput = wrapper.findAll('input')[0];
      await nameInput.setValue('users_v2');
      await wrapper.find('.confirm-btn').trigger('click');

      const events = wrapper.emitted('confirm');
      expect(events).toBeTruthy();
      const payload = events?.[0]?.[0] as Record<string, unknown>;
      expect(payload.name).toBe('users_v2');
      // unchanged keys are preserved from props.options snapshot
      expect(payload.engine).toBe('InnoDB');
   });

   it('hide button re-emits hide to parent', async () => {
      const wrapper = mount();
      await wrapper.find('.hide-btn').trigger('click');
      expect(wrapper.emitted('hide')).toBeTruthy();
   });

   it('does not mutate props.options directly (snapshot pattern)', async () => {
      const original = { ...baseOptions };
      const wrapper = mount({ options: original });
      const nameInput = wrapper.findAll('input')[0];
      await nameInput.setValue('changed');
      // Original prop reference should still hold the pre-edit name
      expect(original.name).toBe('users');
   });
});
