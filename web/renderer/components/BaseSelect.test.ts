/**
 * Tests for BaseSelect.
 *
 * Project's own dropdown primitive (NOT shadcn-vue Combobox directly) that
 * normalizes options into groups, bridges legacy emits (select / change /
 * blur / open / close), and switches between a Combobox (searchable=true)
 * and a Select (searchable=false) under the hood. Tests focus on the public
 * API: prop normalization, computed labels, modelValue round-trip via the
 * onUpdate handler, and event emission shape — not the Reka UI internals.
 */
import { createTestingPinia } from '@pinia/testing';
import { mount as vtuMount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import BaseSelect from './BaseSelect.vue';

// BaseSelect renders a BaseIcon (chevron) which calls useConnectionsStore()
// at setup time — every mount needs an active Pinia. We install the testing
// Pinia inline so callers can keep using plain `mount(BaseSelect, ...)`
// signatures (the pass-through generic on mountWithPinia loses prop typing).
const mount = (_component: typeof BaseSelect, overrides: Record<string, unknown> = {}) => {
   const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn });
   const { global: globalOpts, ...rest } = overrides as {
      global?: { plugins?: unknown[]; [k: string]: unknown };
      [k: string]: unknown;
   };
   return vtuMount(BaseSelect, {
      ...rest,
      global: {
         ...(globalOpts ?? {}),
         plugins: [pinia, ...((globalOpts?.plugins as unknown[]) ?? [])]
      }
   } as Parameters<typeof vtuMount>[1]);
};

const flatOptions = [
   { value: 'a', label: 'Apple' },
   { value: 'b', label: 'Banana' },
   { value: 'c', label: 'Cherry' }
];

describe('BaseSelect', () => {
   it('mounts with empty options without throwing', () => {
      expect(() => mount(BaseSelect, { props: { options: [] } })).not.toThrow();
   });

   it('mounts with flat options array', () => {
      const wrapper = mount(BaseSelect, { props: { options: flatOptions, modelValue: 'a' } });
      expect(wrapper.exists()).toBe(true);
   });

   it('renders the Combobox branch when searchable=true (default)', () => {
      const wrapper = mount(BaseSelect, { props: { options: flatOptions, modelValue: 'a' } });
      // Combobox wires an input element; Select branch does not.
      expect(wrapper.find('input').exists()).toBe(true);
   });

   it('renders the Select branch when searchable=false (no input)', () => {
      const wrapper = mount(BaseSelect, {
         props: { options: flatOptions, modelValue: 'a', searchable: false }
      });
      expect(wrapper.find('input').exists()).toBe(false);
   });

   it('exposes the current option label as ComboboxInput display value', () => {
      const wrapper = mount(BaseSelect, { props: { options: flatOptions, modelValue: 'b' } });
      const input = wrapper.find('input');
      // ComboboxInput uses :display-value to set the input value to the option label
      expect((input.element as HTMLInputElement).value).toBe('Banana');
   });

   it('falls back to placeholder when modelValue does not match any option', () => {
      const wrapper = mount(BaseSelect, {
         props: { options: flatOptions, modelValue: 'zzz', placeholder: 'Choose...', searchable: true }
      });
      const input = wrapper.find('input');
      expect(input.attributes('placeholder')).toBe('Choose...');
   });

   it('emits update:modelValue + select + change when onUpdate is invoked', async () => {
      const wrapper = mount(BaseSelect, { props: { options: flatOptions, modelValue: 'a' } });
      // Drive the public behavior via the component's exposed onUpdate path.
      // We exercise it by updating modelValue from outside, which the template
      // forwards via @update:model-value → onUpdate.
      // Instead we call the handler directly through the component instance:
      const vm = wrapper.vm as unknown as { onUpdate: (v: unknown) => void };
      vm.onUpdate('c');
      await wrapper.vm.$nextTick();

      const emitted = wrapper.emitted();
      expect(emitted['update:modelValue']).toBeTruthy();
      expect(emitted['update:modelValue']![0]).toEqual(['c']);
      expect(emitted.select).toBeTruthy();
      expect(emitted.change).toBeTruthy();
      // Both `select` and `change` get the matched original option object
      expect(emitted.select![0]).toEqual([{ value: 'c', label: 'Cherry' }]);
      expect(emitted.change![0]).toEqual([{ value: 'c', label: 'Cherry' }]);
   });

   it('emits update:modelValue with raw value when no option matches', async () => {
      const wrapper = mount(BaseSelect, { props: { options: flatOptions, modelValue: 'a' } });
      const vm = wrapper.vm as unknown as { onUpdate: (v: unknown) => void };
      vm.onUpdate('does-not-exist');
      await wrapper.vm.$nextTick();

      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['does-not-exist']);
      // select / change fall back to the raw value
      expect(wrapper.emitted('select')![0]).toEqual(['does-not-exist']);
      expect(wrapper.emitted('change')![0]).toEqual(['does-not-exist']);
   });

   it('keeps internal value in sync when modelValue prop changes', async () => {
      const wrapper = mount(BaseSelect, { props: { options: flatOptions, modelValue: 'a' } });
      await wrapper.setProps({ modelValue: 'c' });
      const input = wrapper.find('input');
      expect((input.element as HTMLInputElement).value).toBe('Cherry');
   });

   it('accepts legacy `value` prop without throwing when modelValue is undefined', () => {
      // Source initializes internalValue from props.value when modelValue is
      // undefined, and a watch keeps them in sync. We only assert that this
      // legacy path mounts cleanly — the rendered display text comes from
      // ComboboxInput's internal v-model wiring which is harder to drive in
      // a unit test without exercising Reka UI internals.
      expect(() =>
         mount(BaseSelect, { props: { options: flatOptions, value: 'b' } })
      ).not.toThrow();
   });

   it('respects custom optionLabel string accessor', () => {
      const wrapper = mount(BaseSelect, {
         props: {
            options: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }],
            optionTrackBy: 'id',
            optionLabel: 'name',
            modelValue: 2
         }
      });
      const input = wrapper.find('input');
      expect((input.element as HTMLInputElement).value).toBe('Beta');
   });

   it('respects custom optionLabel function accessor', () => {
      const wrapper = mount(BaseSelect, {
         props: {
            options: [{ id: 1, first: 'A', last: 'A1' }, { id: 2, first: 'B', last: 'B2' }],
            optionTrackBy: 'id',
            optionLabel: (o: { first: string; last: string }) => `${o.first}-${o.last}`,
            modelValue: 1
         }
      });
      const input = wrapper.find('input');
      expect((input.element as HTMLInputElement).value).toBe('A-A1');
   });

   it('handles grouped options via groupValues / groupLabel', () => {
      const grouped = [
         { fruitGroup: 'Citrus', items: [{ value: 'or', label: 'Orange' }, { value: 'le', label: 'Lemon' }] },
         { fruitGroup: 'Berry', items: [{ value: 'st', label: 'Strawberry' }] }
      ];
      const wrapper = mount(BaseSelect, {
         props: {
            options: grouped,
            groupValues: 'items',
            groupLabel: 'fruitGroup',
            modelValue: 'le'
         }
      });
      const input = wrapper.find('input');
      expect((input.element as HTMLInputElement).value).toBe('Lemon');
   });

   it('forwards disabled attribute to the underlying input', () => {
      const wrapper = mount(BaseSelect, {
         props: { options: flatOptions, modelValue: 'a', disabled: true }
      });
      const input = wrapper.find('input');
      expect(input.attributes('disabled')).toBeDefined();
   });

   it('forwards tabindex attribute', () => {
      const wrapper = mount(BaseSelect, {
         props: { options: flatOptions, modelValue: 'a', tabindex: 5 }
      });
      const input = wrapper.find('input');
      expect(input.attributes('tabindex')).toBe('5');
   });

   it('emits open / close / blur via onOpenChange', async () => {
      const wrapper = mount(BaseSelect, { props: { options: flatOptions, modelValue: 'a' } });
      const vm = wrapper.vm as unknown as { onOpenChange: (open: boolean) => void };

      vm.onOpenChange(true);
      await wrapper.vm.$nextTick();
      expect(wrapper.emitted('open')).toBeTruthy();

      vm.onOpenChange(false);
      await wrapper.vm.$nextTick();
      expect(wrapper.emitted('close')).toBeTruthy();
      expect(wrapper.emitted('blur')).toBeTruthy();
   });

   it('does not re-emit open events when state does not change', async () => {
      const wrapper = mount(BaseSelect, { props: { options: flatOptions, modelValue: 'a' } });
      const vm = wrapper.vm as unknown as { onOpenChange: (open: boolean) => void };

      vm.onOpenChange(true);
      vm.onOpenChange(true);
      await wrapper.vm.$nextTick();
      const opens = wrapper.emitted('open') ?? [];
      expect(opens.length).toBe(1);
   });

   it('treats object option values via JSON-equality (sameValue helper)', () => {
      const objOptions = [
         { value: { id: 1 }, label: 'One' },
         { value: { id: 2 }, label: 'Two' }
      ];
      const wrapper = mount(BaseSelect, {
         props: { options: objOptions, modelValue: { id: 2 } }
      });
      const input = wrapper.find('input');
      expect((input.element as HTMLInputElement).value).toBe('Two');
   });
});
