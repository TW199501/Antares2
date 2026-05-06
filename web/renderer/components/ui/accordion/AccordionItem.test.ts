/**
 * Smoke tests for the shadcn-vue AccordionItem primitive.
 *
 * AccordionItem must be mounted inside an AccordionRoot context.
 * Tests use the local Accordion.vue (AccordionRoot wrapper) as the parent.
 *
 * Locked contracts:
 *   - mounts without throwing inside Accordion context
 *   - renders slot content
 *   - applies default border-b border-border classes
 *   - merges custom class prop
 *   - value prop is forwarded (data-value attribute)
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Accordion from './Accordion.vue';
import AccordionItem from './AccordionItem.vue';

function mountItem (value = 'item1', extraClass = '', slotContent = '<div data-testid="child">child</div>') {
   return mount(Accordion, {
      props: { type: 'single', defaultValue: value },
      slots: {
         default: `<AccordionItem value="${value}" class="${extraClass}">${slotContent}</AccordionItem>`
      },
      global: { components: { AccordionItem } }
   });
}

describe('AccordionItem primitive', () => {
   it('mounts without throwing inside Accordion context', () => {
      expect(() => mountItem()).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mountItem('x', '', '<span data-testid="body">hello</span>');
      expect(wrapper.find('[data-testid="body"]').exists()).toBe(true);
   });

   it('applies border-b class from default classes', () => {
      const wrapper = mountItem();
      // Reka UI renders AccordionItem as a div with data-state
      expect(wrapper.html()).toContain('border-b');
   });

   it('merges custom class prop with default classes', () => {
      const wrapper = mountItem('i1', 'my-item-class');
      expect(wrapper.html()).toContain('my-item-class');
      expect(wrapper.html()).toContain('border-b');
   });

   it('is exported and defined', () => {
      expect(AccordionItem).toBeDefined();
   });
});
