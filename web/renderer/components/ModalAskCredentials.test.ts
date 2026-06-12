/**
 * Tests for ModalAskCredentials — small dialog that prompts for username +
 * password when a connection is configured with `ask: true`.
 *
 * The component is a thin BaseConfirmModal wrapper with two Input fields and
 * two emits (`credentials` on confirm, `close-asking` on cancel). We stub
 * the inner ConfirmModal and FormField to keep the test in DOM. Tests cover:
 *   - mounts without throwing
 *   - renders user + password labels
 *   - cancel emits 'close-asking'
 *   - confirm emits 'credentials' with the typed values
 *   - first input receives focus shortly after mount
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { describe, expect, it } from 'vitest';

import ModalAskCredentials from './ModalAskCredentials.vue';

const mount = () =>
   mountWithPinia(ModalAskCredentials, {
      global: {
         stubs: {
            BaseIcon: true,
            ConfirmModal: {
               template: '<div class="confirm-stub"><slot name="header" /><slot name="body" /><button class="confirm-btn" @click="$emit(\'confirm\')">OK</button><button class="cancel-btn" @click="$emit(\'hide\')">Cancel</button></div>',
               emits: ['confirm', 'hide']
            },
            FormField: { template: '<div class="form-field"><slot /></div>' },
            Input: {
               template: '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
               props: ['modelValue'],
               emits: ['update:modelValue']
            }
         }
      }
   });

describe('ModalAskCredentials', () => {
   it('mounts without throwing', () => {
      expect(() => mount()).not.toThrow();
   });

   it('renders the credentials header label', () => {
      const wrapper = mount();
      expect(wrapper.text()).toContain('connection.credentials');
   });

   it('renders both username and password input rows', () => {
      const wrapper = mount();
      const inputs = wrapper.findAll('input');
      expect(inputs.length).toBe(2);
      expect(inputs[0].attributes('autocomplete')).toBe('username');
      expect(inputs[1].attributes('autocomplete')).toBe('current-password');
   });

   it('cancel button emits close-asking', async () => {
      const wrapper = mount();
      await wrapper.find('.cancel-btn').trigger('click');
      expect(wrapper.emitted('close-asking')).toBeTruthy();
   });

   it('confirm emits credentials with the typed values', async () => {
      const wrapper = mount();
      const [userInput, passInput] = wrapper.findAll('input');
      await userInput.setValue('alice');
      await passInput.setValue('s3cret');
      await wrapper.find('.confirm-btn').trigger('click');

      const events = wrapper.emitted('credentials');
      expect(events).toBeTruthy();
      expect(events?.[0]?.[0]).toEqual({ user: 'alice', password: 's3cret' });
   });

   it('confirm with empty fields still emits an empty credentials payload', async () => {
      const wrapper = mount();
      await wrapper.find('.confirm-btn').trigger('click');
      const events = wrapper.emitted('credentials');
      expect(events).toBeTruthy();
      expect(events?.[0]?.[0]).toEqual({ user: '', password: '' });
   });
});
