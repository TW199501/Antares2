import { createTestingPinia } from '@pinia/testing';
import { mount, type VueWrapper } from '@vue/test-utils';
import { vi } from 'vitest';
import { defineComponent, h } from 'vue';

/**
 * Mount a composable inside a dummy component, returning [composableResult, wrapper].
 *
 * Why a wrapper component instead of plain runWithContext?
 *   Composables that touch onMounted / onUnmounted / provide-inject need a real
 *   component instance lifecycle. mount() gives us that for free.
 *
 * Pinia is auto-installed (createTestingPinia) so composables that consume
 * stores work without extra setup.
 *
 * Usage:
 *   const [{ count, increment }, wrapper] = mountComposable(() => useCounter())
 *   increment(); await wrapper.vm.$nextTick();
 *   expect(count.value).toBe(1)
 */
export function mountComposable<T> (
   setup: () => T
): [T, VueWrapper<unknown>] {
   let result: T = undefined as unknown as T;
   const Probe = defineComponent({
      setup () {
         result = setup();
         return () => h('div');
      }
   });
   const wrapper = mount(Probe, {
      global: {
         plugins: [createTestingPinia({ createSpy: vi.fn })]
      }
   });
   return [result, wrapper];
}
