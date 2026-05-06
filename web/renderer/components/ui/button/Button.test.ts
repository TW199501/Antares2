/**
 * Smoke tests for the shadcn-vue Button primitive.
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders slot content
 *   - default variant applies bg-primary
 *   - destructive variant applies bg-destructive
 *   - ghost variant does not apply bg-primary or bg-destructive
 *   - size sm applies h-8
 *   - accepts extra class prop and merges it
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Button from './Button.vue';

describe('Button primitive', () => {
   it('mounts without throwing', () => {
      expect(() => mount(Button)).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(Button, { slots: { default: '<span data-testid="btn-inner">Click</span>' } });
      expect(wrapper.find('[data-testid="btn-inner"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="btn-inner"]').text()).toBe('Click');
   });

   it('default variant class includes bg-primary', () => {
      const wrapper = mount(Button);
      expect(wrapper.html()).toContain('bg-primary');
   });

   it('destructive variant class includes bg-destructive', () => {
      const wrapper = mount(Button, { props: { variant: 'destructive' } });
      expect(wrapper.html()).toContain('bg-destructive');
   });

   it('ghost variant does not include bg-primary or bg-destructive', () => {
      const wrapper = mount(Button, { props: { variant: 'ghost' } });
      const html = wrapper.html();
      expect(html).not.toContain('bg-primary');
      expect(html).not.toContain('bg-destructive');
   });

   it('size sm class includes h-8', () => {
      const wrapper = mount(Button, { props: { size: 'sm' } });
      expect(wrapper.html()).toContain('h-8');
   });

   it('accepts extra class prop and merges it', () => {
      const wrapper = mount(Button, { props: { class: 'btn-custom' } });
      expect(wrapper.html()).toContain('btn-custom');
   });
});
