/**
 * Smoke tests for the shadcn-vue Accordion primitive (reka-ui AccordionRoot wrapper).
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders slot content
 *   - applies default w-full class
 *   - merges custom class prop
 *   - accepts type="multiple" without throwing
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Accordion from './Accordion.vue';

describe('Accordion primitive (reka-ui AccordionRoot wrapper)', () => {
   it('mounts without throwing (type=single)', () => {
      expect(() =>
         mount(Accordion, {
            props: { type: 'single' },
            slots: { default: '<div>content</div>' }
         })
      ).not.toThrow();
   });

   it('mounts without throwing (type=multiple)', () => {
      expect(() =>
         mount(Accordion, {
            props: { type: 'multiple' },
            slots: { default: '<div>content</div>' }
         })
      ).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(Accordion, {
         props: { type: 'single' },
         slots: { default: '<span data-testid="inner">hello</span>' }
      });
      expect(wrapper.find('[data-testid="inner"]').exists()).toBe(true);
   });

   it('applies default w-full class', () => {
      const wrapper = mount(Accordion, {
         props: { type: 'single' },
         slots: { default: '<div />' }
      });
      expect(wrapper.html()).toContain('w-full');
   });

   it('merges custom class prop with default classes', () => {
      const wrapper = mount(Accordion, {
         props: { type: 'single', class: 'my-accordion' },
         slots: { default: '<div />' }
      });
      expect(wrapper.html()).toContain('my-accordion');
      expect(wrapper.html()).toContain('w-full');
   });
});
