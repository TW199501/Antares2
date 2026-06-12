/**
 * Smoke tests for the shadcn-vue TabsContent primitive.
 *
 * TabsContent must be mounted inside a Tabs context.
 *
 * Locked contracts:
 *   - mounts without throwing inside Tabs context
 *   - renders slot content when the matching value is selected
 *   - applies default focus-visible ring classes
 *   - merges custom class prop
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Tabs from './Tabs.vue';
import TabsContent from './TabsContent.vue';

function mountContent (value = 'tab1', defaultValue = 'tab1', extraClass = '', slotContent = '<span data-testid="body">body</span>') {
   return mount(Tabs, {
      props: { defaultValue },
      slots: {
         default: `<TabsContent value="${value}" class="${extraClass}">${slotContent}</TabsContent>`
      },
      global: { components: { TabsContent } }
   });
}

describe('TabsContent primitive', () => {
   it('mounts without throwing inside Tabs context', () => {
      expect(() => mountContent()).not.toThrow();
   });

   it('renders slot content for active tab', () => {
      const wrapper = mountContent('active', 'active');
      // Reka UI renders the content panel when value matches default-value
      expect(wrapper.find('[data-testid="body"]').exists()).toBe(true);
   });

   it('applies mt-2 class from default classes', () => {
      const wrapper = mountContent();
      const panel = wrapper.find('[role="tabpanel"]');
      expect(panel.exists()).toBe(true);
      expect(panel.classes()).toContain('mt-2');
   });

   it('applies ring-offset-background class', () => {
      const wrapper = mountContent();
      const panel = wrapper.find('[role="tabpanel"]');
      expect(panel.classes()).toContain('ring-offset-background');
   });

   it('merges custom class prop', () => {
      const wrapper = mountContent('tab1', 'tab1', 'my-content-class');
      const panel = wrapper.find('[role="tabpanel"]');
      expect(panel.classes()).toContain('my-content-class');
      expect(panel.classes()).toContain('mt-2');
   });
});
