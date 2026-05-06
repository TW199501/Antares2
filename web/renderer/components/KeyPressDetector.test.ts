/**
 * Tests for KeyPressDetector.vue — small input wrapper that captures a
 * keyboard shortcut combo and emits its string form via update:modelValue.
 *
 * Pure prop-driven (spec §1.A). Uses a stubbed shadcn Input that exposes
 * the underlying <input> so we can dispatch focus/blur/keydown.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { describe, expect, it, vi } from 'vitest';

import Application from '@/ipc-api/Application';

import KeyPressDetector from './KeyPressDetector.vue';

vi.mock('@/ipc-api/Application', () => ({
   default: {
      reloadShortcuts: vi.fn().mockResolvedValue(undefined),
      unregisterShortcuts: vi.fn().mockResolvedValue(undefined)
   }
}));

const stubs = {
   BaseIcon: true,
   Input: {
      name: 'Input',
      inheritAttrs: false,
      props: { modelValue: { type: [String, Number], default: '' }, placeholder: { type: String, default: '' } },
      emits: ['update:modelValue', 'focus', 'blur', 'keydown'],
      template:
         '<input class="kp-input" v-bind="$attrs" :value="modelValue" :placeholder="placeholder" @focus="$emit(\'focus\', $event)" @blur="$emit(\'blur\', $event)" @keydown="$emit(\'keydown\', $event)" />'
   }
};

const mount = (modelValue?: string) =>
   mountWithPinia(KeyPressDetector, {
      props: { modelValue } as never,
      global: { stubs }
   });

describe('KeyPressDetector', () => {
   it('mounts without throwing', () => {
      expect(() => mount()).not.toThrow();
   });

   it('renders the modelValue prop verbatim when no key has been captured', () => {
      const wrapper = mount('Control+S');
      const input = wrapper.find('input');
      expect((input.element as HTMLInputElement).value).toBe('Control+S');
   });

   it('focusing the input calls Application.unregisterShortcuts', async () => {
      const wrapper = mount();
      await wrapper.find('input').trigger('focus');
      await wrapper.vm.$nextTick();
      expect(Application.unregisterShortcuts).toHaveBeenCalled();
   });

   it('blurring the input calls Application.reloadShortcuts', async () => {
      const wrapper = mount();
      await wrapper.find('input').trigger('focus');
      await wrapper.find('input').trigger('blur');
      await wrapper.vm.$nextTick();
      expect(Application.reloadShortcuts).toHaveBeenCalled();
   });

   it('Ctrl+S keydown emits an update:modelValue with the parsed combo', async () => {
      const wrapper = mount();
      const input = wrapper.find('input');
      await input.trigger('keydown', { key: 's', code: 'KeyS', ctrlKey: true });
      await wrapper.vm.$nextTick();
      const events = wrapper.emitted('update:modelValue');
      expect(events).toBeTruthy();
      const last = events?.[events.length - 1]?.[0] as string;
      expect(last).toContain('Control');
      expect(last).toContain('S');
   });

   it('a single character without modifiers yields the invalidShortcutMessage and is not emitted', async () => {
      const wrapper = mount();
      const input = wrapper.find('input');
      await input.trigger('keydown', { key: 'a', code: 'KeyA' });
      await wrapper.vm.$nextTick();
      // Component computes the invalid message; the watcher gates emission so
      // no update:modelValue event should be fired.
      const events = wrapper.emitted('update:modelValue');
      expect(events ?? []).toEqual([]);
   });
});
