/**
 * Smoke tests for the shadcn-vue ContextMenuShortcut primitive.
 *
 * ContextMenuShortcut is a plain <span> wrapper — no Reka UI context required.
 * It renders the shortcut hint text alongside a menu item label.
 *
 * Locked contracts:
 *   - mounts without throwing standalone
 *   - renders slot content
 *   - carries default ml-auto tracking-widest text-muted-foreground classes
 *   - merges custom class prop
 *   - component is exported/defined
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ContextMenuShortcut from './ContextMenuShortcut.vue';

describe('ContextMenuShortcut primitive', () => {
   it('mounts without throwing standalone', () => {
      expect(() =>
         mount(ContextMenuShortcut, { slots: { default: '⌘K' } })
      ).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(ContextMenuShortcut, { slots: { default: '⌘K' } });
      expect(wrapper.text()).toBe('⌘K');
   });

   it('applies default ml-auto class', () => {
      const wrapper = mount(ContextMenuShortcut, { slots: { default: '⌘K' } });
      expect(wrapper.classes()).toContain('ml-auto');
   });

   it('applies default tracking-widest class', () => {
      const wrapper = mount(ContextMenuShortcut, { slots: { default: '⌘K' } });
      expect(wrapper.classes()).toContain('tracking-widest');
   });

   it('merges custom class prop with default classes', () => {
      const wrapper = mount(ContextMenuShortcut, {
         props: { class: 'my-shortcut-class' },
         slots: { default: 'Ctrl+Z' }
      });
      expect(wrapper.classes()).toContain('my-shortcut-class');
      expect(wrapper.classes()).toContain('ml-auto');
   });
});
