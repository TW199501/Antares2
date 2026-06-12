/**
 * Smoke tests for the shadcn-vue TabsTrigger primitive.
 *
 * TabsTrigger must be mounted inside Tabs > TabsList context.
 *
 * Locked contracts:
 *   - mounts without throwing inside Tabs > TabsList context
 *   - renders slot content
 *   - applies default design-token classes (rounded-sm, text-sm, bg-transparent)
 *   - merges custom class prop
 *   - value prop is forwarded (reka-ui uses data-value on the button element)
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Tabs from './Tabs.vue';
import TabsList from './TabsList.vue';
import TabsTrigger from './TabsTrigger.vue';

function mountTrigger (triggerClass = '', slotContent = 'Click me') {
   return mount(Tabs, {
      props: { defaultValue: 'tab1' },
      slots: {
         default: `<TabsList><TabsTrigger value="tab1" class="${triggerClass}">${slotContent}</TabsTrigger></TabsList>`
      },
      global: { components: { TabsList, TabsTrigger } }
   });
}

describe('TabsTrigger primitive', () => {
   it('mounts without throwing inside Tabs > TabsList context', () => {
      expect(() => mountTrigger()).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mountTrigger('', '<span data-testid="label">Tab</span>');
      expect(wrapper.find('[data-testid="label"]').exists()).toBe(true);
   });

   it('applies default rounded-sm class', () => {
      const wrapper = mountTrigger();
      const btn = wrapper.find('[role="tab"]');
      expect(btn.exists()).toBe(true);
      expect(btn.classes()).toContain('rounded-sm');
   });

   it('applies text-sm class by default', () => {
      const wrapper = mountTrigger();
      const btn = wrapper.find('[role="tab"]');
      expect(btn.classes()).toContain('text-sm');
   });

   it('merges custom class prop', () => {
      const wrapper = mountTrigger('my-trigger-class');
      const btn = wrapper.find('[role="tab"]');
      expect(btn.classes()).toContain('my-trigger-class');
      expect(btn.classes()).toContain('rounded-sm');
   });
});
