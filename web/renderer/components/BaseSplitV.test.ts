/**
 * Tests for BaseSplitV.
 *
 * Vertical split panel with a draggable resize handle. Renders top + bottom
 * named slots, exposes pointer-driven resize via the handle, and emits both
 * `update:topHeight` (continuous) and `resize-end` (final). Double-clicking
 * the handle resets to `defaultTopHeight`. The `resolvedTopHeight` computed
 * clamps below `minTop` so stale persisted heights survive viewport shrinks.
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import BaseSplitV from './BaseSplitV.vue';

const mountSplit = (props: Record<string, unknown> = {}, slots: Record<string, string> = {}) =>
   mount(BaseSplitV, {
      props: { topHeight: 200, ...props },
      slots: {
         top: '<div data-testid="top-slot">TOP</div>',
         bottom: '<div data-testid="bottom-slot">BOTTOM</div>',
         ...slots
      }
   });

describe('BaseSplitV', () => {
   it('mounts without throwing', () => {
      expect(() => mountSplit()).not.toThrow();
   });

   it('renders both top and bottom slots', () => {
      const wrapper = mountSplit();
      expect(wrapper.find('[data-testid="top-slot"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="bottom-slot"]').exists()).toBe(true);
   });

   it('renders a handle with role="separator" and horizontal orientation', () => {
      const wrapper = mountSplit();
      const handle = wrapper.find('[role="separator"]');
      expect(handle.exists()).toBe(true);
      expect(handle.attributes('aria-orientation')).toBe('horizontal');
   });

   it('forwards topHeight to the top container inline style', () => {
      const wrapper = mountSplit({ topHeight: 250 });
      const topPanel = wrapper.element.children[0] as HTMLElement;
      expect(topPanel.style.height).toBe('250px');
   });

   it('clamps the rendered height to minTop when topHeight is below minTop', () => {
      const wrapper = mountSplit({ topHeight: 20, minTop: 100 });
      const topPanel = wrapper.element.children[0] as HTMLElement;
      expect(topPanel.style.height).toBe('100px');
   });

   it('exposes the resolved (clamped) height on the handle aria-valuenow', () => {
      const wrapper = mountSplit({ topHeight: 50, minTop: 80 });
      const handle = wrapper.find('[role="separator"]');
      expect(handle.attributes('aria-valuenow')).toBe('80');
   });

   it('emits update:topHeight + resize-end with defaultTopHeight on double-click', async () => {
      const wrapper = mountSplit({ topHeight: 200, defaultTopHeight: 320 });
      const handle = wrapper.find('[role="separator"]');
      await handle.trigger('dblclick');
      expect(wrapper.emitted('update:topHeight')).toBeTruthy();
      expect(wrapper.emitted('update:topHeight')![0]).toEqual([320]);
      expect(wrapper.emitted('resize-end')).toBeTruthy();
      expect(wrapper.emitted('resize-end')![0]).toEqual([320]);
   });

   it('toggles the active drag class when pointerdown begins', async () => {
      const wrapper = mountSplit({ topHeight: 200 });
      const handle = wrapper.find('[role="separator"]');

      // Before drag: should not have the !bg-primary marker
      expect(handle.classes()).not.toContain('!bg-primary');

      await handle.trigger('pointerdown', { clientY: 100, pointerId: 1 });
      // isDragging flips true → !bg-primary class binding applies
      expect(handle.classes()).toContain('!bg-primary');
   });

   it('emits update:topHeight on pointermove during drag', async () => {
      const wrapper = mountSplit({ topHeight: 200, minTop: 50, minBottom: 50 });
      const handle = wrapper.find('[role="separator"]');

      // Stub container bounding rect so the maxTop math is deterministic
      const container = wrapper.element as HTMLElement;
      Object.defineProperty(container, 'getBoundingClientRect', {
         configurable: true,
         value: () => ({ height: 600, width: 800, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => '' })
      });

      await handle.trigger('pointerdown', { clientY: 100, pointerId: 1 });

      // Simulate window pointermove (the component listens on `window`)
      const moveEvt = new PointerEvent('pointermove', { clientY: 150 });
      window.dispatchEvent(moveEvt);

      const updates = wrapper.emitted('update:topHeight') ?? [];
      expect(updates.length).toBeGreaterThan(0);
      // Started at 200 (resolved), delta +50 → next = 250
      const last = updates[updates.length - 1] as [number];
      expect(last[0]).toBe(250);
   });

   it('emits resize-end on pointerup with the resolved current height', async () => {
      const wrapper = mountSplit({ topHeight: 175 });
      const handle = wrapper.find('[role="separator"]');

      Object.defineProperty(wrapper.element, 'getBoundingClientRect', {
         configurable: true,
         value: () => ({ height: 600, width: 800, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => '' })
      });

      await handle.trigger('pointerdown', { clientY: 0, pointerId: 1 });
      window.dispatchEvent(new PointerEvent('pointerup'));

      const ends = wrapper.emitted('resize-end') ?? [];
      expect(ends.length).toBe(1);
      expect((ends[0] as [number])[0]).toBe(175);
   });

   it('uses default props when not provided', () => {
      const wrapper = mountSplit();
      expect(wrapper.props('minTop')).toBe(80);
      expect(wrapper.props('minBottom')).toBe(80);
      expect(wrapper.props('defaultTopHeight')).toBe(300);
   });
});
