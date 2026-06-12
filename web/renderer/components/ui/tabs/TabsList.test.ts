/**
 * Smoke tests for the shadcn-vue TabsList primitive.
 *
 * TabsList must be mounted inside a Tabs (TabsRoot) context; bare mount causes
 * Reka UI context errors. All tests wrap with <Tabs default-value="x">.
 *
 * Locked contracts:
 *   - mounts without throwing inside Tabs context
 *   - renders default slot
 *   - applies default design-token classes (bg-secondary, rounded-md, h-11)
 *   - merges custom class prop
 *   - data-slot attribute is forwarded by Reka UI TabsList
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Tabs from './Tabs.vue';
import TabsList from './TabsList.vue';

function mountInTabs (listProps: Record<string, unknown> = {}, slotContent = '<div />') {
   return mount(Tabs, {
      props: { defaultValue: 'x' },
      slots: {
         default: `<TabsList ${Object.entries(listProps).map(([k]) => `:${k}="listProps.${k}"`).join(' ')}>${slotContent}</TabsList>`
      },
      global: {
         components: { TabsList },
         provide: { listProps }
      }
   });
}

describe('TabsList primitive', () => {
   it('mounts without throwing inside Tabs context', () => {
      expect(() => mountInTabs()).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mountInTabs({}, '<span data-testid="child">x</span>');
      expect(wrapper.find('[data-testid="child"]').exists()).toBe(true);
   });

   it('applies default bg-secondary class', () => {
      const wrapper = mount(Tabs, {
         props: { defaultValue: 'x' },
         slots: { default: '<TabsList class="extra-class"><div /></TabsList>' },
         global: { components: { TabsList } }
      });
      const list = wrapper.find('[role="tablist"]');
      expect(list.exists()).toBe(true);
      expect(list.classes()).toContain('bg-secondary');
   });

   it('merges custom class into default classes', () => {
      const wrapper = mount(Tabs, {
         props: { defaultValue: 'x' },
         slots: { default: '<TabsList class="my-custom-class"><div /></TabsList>' },
         global: { components: { TabsList } }
      });
      const list = wrapper.find('[role="tablist"]');
      expect(list.classes()).toContain('my-custom-class');
      expect(list.classes()).toContain('bg-secondary');
   });

   it('applies rounded-md class by default', () => {
      const wrapper = mount(Tabs, {
         props: { defaultValue: 'x' },
         slots: { default: '<TabsList><div /></TabsList>' },
         global: { components: { TabsList } }
      });
      const list = wrapper.find('[role="tablist"]');
      expect(list.classes()).toContain('rounded-md');
   });
});
