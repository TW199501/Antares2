/**
 * Tests for BaseVirtualScroll.
 *
 * Slot-based virtualizer: renders top spacer + slot(items=visible) + bottom
 * spacer. The wrapper subscribes to scrollTop on `props.scrollElement` (or
 * its own root) and on every scroll event uses a 200ms debounce timer to
 * recompute the visible window via `updateWindow()`. We invoke the exposed
 * `updateWindow()` directly instead of fighting fake timers — it's the same
 * function the debounce calls. Visible window math: visibleItemsCount =
 * ceil(visibleHeight/itemHeight); offset of 50 items pre/post buffers; slice
 * is [firstCutIndex, lastCutIndex). At scrollTop=0 firstCutIndex is 0 so the
 * slot receives the first (visibleItemsCount + 50) items.
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { h } from 'vue';

import BaseVirtualScroll from './BaseVirtualScroll.vue';

function makeItems (n: number) {
   return Array.from({ length: n }, (_, i) => ({ id: i, label: `row-${i}` }));
}

describe('BaseVirtualScroll', () => {
   it('mounts without throwing', () => {
      expect(() =>
         mount(BaseVirtualScroll, {
            props: { items: makeItems(100), itemHeight: 30, visibleHeight: 300 }
         })
      ).not.toThrow();
   });

   it('renders the .vscroll-holder root with two spacer divs', () => {
      const wrapper = mount(BaseVirtualScroll, {
         props: { items: makeItems(100), itemHeight: 30, visibleHeight: 300 }
      });
      expect(wrapper.find('.vscroll-holder').exists()).toBe(true);
      expect(wrapper.findAll('.vscroll-spacer').length).toBe(2);
   });

   it('exposes a slot receiving only the visible window of items at scrollTop=0', async () => {
      const items = makeItems(500);
      // visibleItemsCount = ceil(300/30) = 10; offset = 50 → slot gets 60 items
      const wrapper = mount(BaseVirtualScroll, {
         props: { items, itemHeight: 30, visibleHeight: 300 },
         slots: {
            default: ({ items: visible }: { items: { id: number; label: string }[] }) =>
               visible.map(i => h('div', { class: 'row', key: i.id }, i.label))
         }
      });
      await wrapper.vm.$nextTick();
      const rendered = wrapper.findAll('.row');
      expect(rendered.length).toBe(60);
      expect(rendered[0].text()).toBe('row-0');
      expect(rendered[rendered.length - 1].text()).toBe('row-59');
   });

   it('renders ALL items when total count is below the visible-window+offset', async () => {
      const items = makeItems(20);
      const wrapper = mount(BaseVirtualScroll, {
         props: { items, itemHeight: 30, visibleHeight: 300 },
         slots: {
            default: ({ items: visible }: { items: { id: number }[] }) =>
               visible.map(i => h('div', { class: 'row', key: i.id }))
         }
      });
      await wrapper.vm.$nextTick();
      // slice(0, 60) of 20 items = 20
      expect(wrapper.findAll('.row').length).toBe(20);
   });

   it('updates the visible window when updateWindow() is invoked after scrolling the root', async () => {
      const items = makeItems(500);
      const wrapper = mount(BaseVirtualScroll, {
         props: { items, itemHeight: 30, visibleHeight: 300 },
         slots: {
            default: ({ items: visible }: { items: { id: number; label: string }[] }) =>
               visible.map(i => h('div', { class: 'row', key: i.id }, i.label))
         },
         attachTo: document.body
      });
      // Force a scrollTop on the root and ask the component to recompute
      const root = wrapper.element as HTMLDivElement;
      Object.defineProperty(root, 'scrollTop', { configurable: true, value: 30 * 100 });
      (wrapper.vm as unknown as { updateWindow: () => void }).updateWindow();
      await wrapper.vm.$nextTick();
      // firstVisibleIndex = floor(3000/30) = 100; firstCut = max(100-50,0)=50
      // visibleCount=10; lastCut = 110+50 = 160 → slice(50,160) = 110 rows
      const rendered = wrapper.findAll('.row');
      expect(rendered[0].text()).toBe('row-50');
      expect(rendered.length).toBe(110);
      wrapper.unmount();
   });

   it('uses props.scrollElement when provided as the scroll source', async () => {
      const items = makeItems(500);
      const externalScroll = document.createElement('div');
      Object.defineProperty(externalScroll, 'scrollTop', { configurable: true, value: 30 * 80 });
      // pass a real HTMLDivElement; type-checked HTMLDivElement matches
      const wrapper = mount(BaseVirtualScroll, {
         props: {
            items,
            itemHeight: 30,
            visibleHeight: 300,
            scrollElement: externalScroll
         },
         slots: {
            default: ({ items: visible }: { items: { id: number; label: string }[] }) =>
               visible.map(i => h('div', { class: 'row', key: i.id }, i.label))
         }
      });
      await wrapper.vm.$nextTick();
      // With scrollTop = 30*80 = 2400, firstVisibleIndex = 80, firstCut = 30
      const rendered = wrapper.findAll('.row');
      expect(rendered[0].text()).toBe('row-30');
   });
});
