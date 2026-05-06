/**
 * Tests for ModalAskParameters.vue — the dialog shown before running a
 * stored routine / function so the user can supply IN-parameter values.
 *
 * The SFC wraps BaseConfirmModal (passthrough-stubbed below) and renders one
 * row per `parameter.context === 'IN'`. The bound input uses an inline
 * v-model into `values[`${i}-${parameter.name}`]`. On confirm the SFC emits
 * 'confirm' with an array, quoting strings per `client` (mysql/maria → "x",
 * pg → 'x', other → "x") and leaving NUMBER/FLOAT types unquoted.
 *
 * Coverage focus:
 *   - mount no-throw with a routine that has IN + OUT params (filters to IN)
 *   - confirm emits with mysql double-quoted string + unquoted INT
 *   - confirm with pg single-quoted string
 *   - hide event from inner modal emits 'close'
 *   - Escape keydown on window emits 'close' + cleans listener on unmount
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { describe, expect, it, vi } from 'vitest';

import ModalAskParameters from './ModalAskParameters.vue';

const buildRoutine = () => ({
   name: 'sp_demo',
   parameters: [
      { _antares_id: 'p1', name: 'in_id', context: 'IN', type: 'INT', length: 11 },
      { _antares_id: 'p2', name: 'in_label', context: 'IN', type: 'VARCHAR', length: 50 },
      { _antares_id: 'p3', name: 'out_total', context: 'OUT', type: 'INT', length: 11 }
   ]
});

const mount = (props: Record<string, unknown> = {}) =>
   mountWithPinia(ModalAskParameters, {
      props: {
         localRoutine: buildRoutine(),
         client: 'mysql',
         ...props
      } as never,
      global: {
         stubs: {
            BaseIcon: true,
            ConfirmModal: {
               template:
                  '<div class="confirm-stub"><slot name="header" /><slot name="body" /><button class="confirm-btn" @click="$emit(\'confirm\')">OK</button><button class="cancel-btn" @click="$emit(\'hide\')">X</button></div>',
               emits: ['confirm', 'hide']
            },
            Label: { template: '<label class="label-stub"><slot /></label>' }
         }
      }
   });

describe('ModalAskParameters', () => {
   it('mounts without throwing', () => {
      expect(() => mount()).not.toThrow();
   });

   it('renders one input per IN parameter only (OUT is filtered out)', () => {
      const wrapper = mount();
      const inputs = wrapper.findAll('input[type="text"]');
      expect(inputs.length).toBe(2);
   });

   it('confirm emits the values array with mysql double-quoted strings and unquoted INTs', async () => {
      const wrapper = mount({ client: 'mysql' });
      const [idInput, labelInput] = wrapper.findAll('input[type="text"]');
      await idInput.setValue('42');
      await labelInput.setValue('hello');
      await wrapper.find('.confirm-btn').trigger('click');

      const events = wrapper.emitted('confirm');
      expect(events).toBeTruthy();
      const payload = events?.[0]?.[0] as string[];
      expect(payload).toEqual(['42', '"hello"']);
   });

   it('confirm with pg client uses single-quoted strings', async () => {
      const wrapper = mount({ client: 'pg' });
      const [idInput, labelInput] = wrapper.findAll('input[type="text"]');
      await idInput.setValue('7');
      await labelInput.setValue('world');
      await wrapper.find('.confirm-btn').trigger('click');

      const payload = wrapper.emitted('confirm')?.[0]?.[0] as string[];
      expect(payload).toEqual(['7', '\'world\'']);
   });

   it('hide event from inner modal emits close', async () => {
      const wrapper = mount();
      await wrapper.find('.cancel-btn').trigger('click');
      expect(wrapper.emitted('close')).toBeTruthy();
   });

   it('Escape on window emits close and removes listener on unmount', async () => {
      const wrapper = mount();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await wrapper.vm.$nextTick();
      expect(wrapper.emitted('close')).toBeTruthy();

      const removeSpy = vi.spyOn(window, 'removeEventListener');
      wrapper.unmount();
      const calls = removeSpy.mock.calls.filter(c => c[0] === 'keydown');
      expect(calls.length).toBeGreaterThan(0);
   });
});
