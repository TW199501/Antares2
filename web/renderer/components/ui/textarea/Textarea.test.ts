/**
 * Smoke tests for the shadcn-vue Textarea primitive.
 *
 * Locked contracts:
 *   - mounts without throwing
 *   - renders a <textarea> element
 *   - applies default classes
 *   - merges custom class prop
 *   - modelValue prop binding and update:modelValue emit
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Textarea from './Textarea.vue';

describe('Textarea primitive', () => {
   it('mounts without throwing', () => {
      expect(() => mount(Textarea)).not.toThrow();
   });

   it('renders a <textarea> element', () => {
      const wrapper = mount(Textarea);
      expect(wrapper.find('textarea').exists()).toBe(true);
   });

   it('applies default classes to the textarea', () => {
      const wrapper = mount(Textarea);
      const html = wrapper.find('textarea').element.className;
      expect(html).toContain('min-h-');
      expect(html).toContain('rounded-md');
      expect(html).toContain('border');
   });

   it('merges custom class prop with default classes', () => {
      const wrapper = mount(Textarea, { props: { class: 'font-mono' } });
      expect(wrapper.find('textarea').element.className).toContain('font-mono');
      expect(wrapper.find('textarea').element.className).toContain('rounded-md');
   });

   it('reflects modelValue prop as textarea value', async () => {
      const wrapper = mount(Textarea, { props: { modelValue: 'hello' } });
      const ta = wrapper.find('textarea').element as HTMLTextAreaElement;
      expect(ta.value).toBe('hello');
   });
});
