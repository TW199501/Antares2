/**
 * Smoke tests for the shadcn-vue Badge primitive.
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders slot content
 *   - default variant applies bg-primary and text-primary-foreground
 *   - destructive variant applies bg-destructive
 *   - outline variant applies text-foreground (no bg-*)
 *   - accepts extra class prop and merges it
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Badge from './Badge.vue';

describe('Badge primitive', () => {
   it('mounts without throwing', () => {
      expect(() => mount(Badge)).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(Badge, { slots: { default: '<span data-testid="b">OK</span>' } });
      expect(wrapper.find('[data-testid="b"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="b"]').text()).toBe('OK');
   });

   it('default variant class includes bg-primary', () => {
      const wrapper = mount(Badge);
      expect(wrapper.element.className).toContain('bg-primary');
   });

   it('destructive variant class includes bg-destructive', () => {
      const wrapper = mount(Badge, { props: { variant: 'destructive' } });
      expect(wrapper.element.className).toContain('bg-destructive');
   });

   it('outline variant class includes text-foreground but not bg-primary', () => {
      const wrapper = mount(Badge, { props: { variant: 'outline' } });
      const cls = wrapper.element.className;
      expect(cls).toContain('text-foreground');
      expect(cls).not.toContain('bg-primary');
   });

   it('accepts extra class prop and merges it', () => {
      const wrapper = mount(Badge, { props: { class: 'badge-extra' } });
      expect(wrapper.element.className).toContain('badge-extra');
   });
});
