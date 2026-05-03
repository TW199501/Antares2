import { describe, expect, it } from 'vitest';
import { computed, ref } from 'vue';

import { mountComposable } from './mountComposable';

function useCounter (initial = 0) {
   const count = ref(initial);
   const doubled = computed(() => count.value * 2);
   function increment () {
      count.value++;
   }
   return { count, doubled, increment };
}

describe('mountComposable', () => {
   it('returns the composable result and a wrapper', () => {
      const [api, wrapper] = mountComposable(() => useCounter());
      expect(api.count.value).toBe(0);
      expect(api.doubled.value).toBe(0);
      expect(typeof api.increment).toBe('function');
      expect(wrapper.exists()).toBe(true);
   });

   it('keeps reactivity — actions mutate refs', async () => {
      const [api, wrapper] = mountComposable(() => useCounter(5));
      expect(api.count.value).toBe(5);
      api.increment();
      await wrapper.vm.$nextTick();
      expect(api.count.value).toBe(6);
      expect(api.doubled.value).toBe(12);
   });

   it('teardown via wrapper.unmount() releases reactive scope', () => {
      const [, wrapper] = mountComposable(() => useCounter());
      expect(() => wrapper.unmount()).not.toThrow();
   });
});
