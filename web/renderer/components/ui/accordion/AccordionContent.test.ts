/**
 * Smoke tests for the shadcn-vue AccordionContent primitive.
 *
 * AccordionContent must be mounted inside Accordion > AccordionItem context.
 * Tests use a defaultValue matching the item value so that Reka UI renders
 * the panel (open state).
 *
 * Locked contracts:
 *   - mounts without throwing inside full accordion context
 *   - renders slot content for open item
 *   - outer element applies overflow-hidden + animation classes
 *   - inner div applies pb-4 class
 *   - merges custom class prop on inner div
 *   - component is exported and defined
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Accordion from './Accordion.vue';
import AccordionContent from './AccordionContent.vue';
import AccordionItem from './AccordionItem.vue';

function mountContent (extraClass = '', slotContent = '<span data-testid="text">content text</span>') {
   return mount(Accordion, {
      props: { type: 'single', defaultValue: 'open-item' },
      slots: {
         default: `
            <AccordionItem value="open-item">
               <AccordionContent class="${extraClass}">${slotContent}</AccordionContent>
            </AccordionItem>
         `
      },
      global: { components: { AccordionItem, AccordionContent } }
   });
}

describe('AccordionContent primitive', () => {
   it('mounts without throwing inside full accordion context', () => {
      expect(() => mountContent()).not.toThrow();
   });

   it('renders slot content for open accordion item', () => {
      const wrapper = mountContent('', '<span data-testid="text">content text</span>');
      expect(wrapper.find('[data-testid="text"]').exists()).toBe(true);
   });

   it('applies overflow-hidden to outer AccordionContent element', () => {
      const wrapper = mountContent();
      expect(wrapper.html()).toContain('overflow-hidden');
   });

   it('inner div applies pb-4 class', () => {
      const wrapper = mountContent();
      // The inner <div> wrapping the slot has pb-4
      expect(wrapper.html()).toContain('pb-4');
   });

   it('merges custom class prop on inner div', () => {
      const wrapper = mountContent('custom-content-class');
      expect(wrapper.html()).toContain('custom-content-class');
   });

   it('is exported and defined', () => {
      expect(AccordionContent).toBeDefined();
   });
});
