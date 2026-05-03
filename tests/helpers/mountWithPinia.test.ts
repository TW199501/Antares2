import { defineStore } from 'pinia';
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';

import { mountWithPinia } from './mountWithPinia';

const useDummyStore = defineStore('dummy', {
   state: () => ({ count: 0, label: 'idle' }),
   actions: {
      increment () {
         this.count++;
         this.label = 'running';
      }
   }
});

const Probe = defineComponent({
   setup () {
      const store = useDummyStore();
      return () => h('div', { class: `probe-${store.label}-${store.count}` });
   }
});

describe('mountWithPinia', () => {
   it('mounts a component with a fresh pinia, default state', () => {
      const wrapper = mountWithPinia(Probe);
      expect(wrapper.html()).toContain('probe-idle-0');
   });

   it('seeds initial state via initialState option', () => {
      const wrapper = mountWithPinia(Probe, {
         initialState: { dummy: { count: 5, label: 'preset' } }
      });
      expect(wrapper.html()).toContain('probe-preset-5');
   });

   it('actions execute by default (stubActions: false)', async () => {
      const wrapper = mountWithPinia(Probe);
      const store = useDummyStore();
      store.increment();
      await wrapper.vm.$nextTick();
      expect(wrapper.html()).toContain('probe-running-1');
   });

   it('actions are stubbed when stubActions: true', async () => {
      const wrapper = mountWithPinia(Probe, { stubActions: true });
      const store = useDummyStore();
      store.increment();
      await wrapper.vm.$nextTick();
      // Stubbed action does not mutate state
      expect(wrapper.html()).toContain('probe-idle-0');
   });
});
