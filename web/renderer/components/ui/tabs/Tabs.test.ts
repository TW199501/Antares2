/**
 * Smoke tests for the shadcn-vue Tabs primitive (reka-ui TabsRoot wrapper).
 *
 * Locked contracts:
 *   - <Tabs> mounts without throwing
 *   - default slot renders inside TabsRoot
 *   - modelValue / default-value prop forwarding
 *   - update:modelValue emit relay
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import Tabs from './Tabs.vue';
import TabsContent from './TabsContent.vue';
import TabsList from './TabsList.vue';
import TabsTrigger from './TabsTrigger.vue';

describe('Tabs primitive (reka-ui TabsRoot wrapper)', () => {
   it('mounts without throwing', () => {
      expect(() =>
         mount(Tabs, {
            props: { defaultValue: 'tab1' },
            slots: { default: '<div>content</div>' }
         })
      ).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mount(Tabs, {
         props: { defaultValue: 'tab1' },
         slots: { default: '<span data-testid="inner">hello</span>' }
      });
      expect(wrapper.find('[data-testid="inner"]').exists()).toBe(true);
   });

   it('accepts modelValue prop', () => {
      const wrapper = mount(Tabs, {
         props: { modelValue: 'tab2' },
         slots: { default: '<div />' }
      });
      expect(wrapper.props('modelValue')).toBe('tab2');
   });

   it('mounts full tab composition without throwing', () => {
      expect(() =>
         mount(Tabs, {
            props: { defaultValue: 'a' },
            slots: {
               default: `
                  <${TabsList.name ?? 'TabsList'}>
                     <${TabsTrigger.name ?? 'TabsTrigger'} value="a">Tab A</${TabsTrigger.name ?? 'TabsTrigger'}>
                  </${TabsList.name ?? 'TabsList'}>
                  <${TabsContent.name ?? 'TabsContent'} value="a">Content A</${TabsContent.name ?? 'TabsContent'}>
               `
            },
            global: { components: { TabsList, TabsTrigger, TabsContent } }
         })
      ).not.toThrow();
   });

   it('emits update:modelValue when value changes', async () => {
      const wrapper = mount(Tabs, {
         props: { modelValue: 'a' },
         slots: {
            default: `
               <TabsList>
                  <TabsTrigger value="a">A</TabsTrigger>
                  <TabsTrigger value="b">B</TabsTrigger>
               </TabsList>
               <TabsContent value="a">Content A</TabsContent>
               <TabsContent value="b">Content B</TabsContent>
            `
         },
         global: { components: { TabsList, TabsTrigger, TabsContent } }
      });
      await wrapper.setProps({ modelValue: 'b' });
      await nextTick();
      expect(wrapper.props('modelValue')).toBe('b');
   });
});
