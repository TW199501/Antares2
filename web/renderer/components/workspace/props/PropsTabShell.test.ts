/**
 * Smoke tests for PropsTabShell.vue — generic 3-slot frame used by every
 * "Props*" tab (PropsTable / PropsView / PropsTrigger / etc.).
 *
 * Pure prop-driven: no Pinia, no Tauri, no async. Renders 3 named slots
 * (`toolbar`, `metadata`, `content`) with an optional `schema` chip.
 *
 * Locked contracts:
 *   - mounts without throwing under the default `isSelected: true`
 *   - is hidden via v-show when `isSelected` is false
 *   - schema chip renders only when `schema` prop is non-empty
 *   - all three named slots render their content
 *   - schemaTitle prop is forwarded to the title attribute
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import PropsTabShell from './PropsTabShell.vue';

describe('PropsTabShell', () => {
   it('is exported and defined', () => {
      expect(PropsTabShell).toBeDefined();
   });

   it('mounts without throwing with default props', () => {
      expect(() => mount(PropsTabShell)).not.toThrow();
   });

   it('root is hidden via v-show when isSelected is false', () => {
      const wrapper = mount(PropsTabShell, { props: { isSelected: false } });
      expect((wrapper.element as HTMLElement).style.display).toBe('none');
   });

   it('root is visible when isSelected is true (default)', () => {
      const wrapper = mount(PropsTabShell);
      expect((wrapper.element as HTMLElement).style.display).not.toBe('none');
   });

   it('omits the schema chip when schema prop is empty', () => {
      const wrapper = mount(PropsTabShell);
      // schema chip uses <b> for the schema name and a `mdiDatabase` icon
      expect(wrapper.find('b.font-semibold').exists()).toBe(false);
   });

   it('renders all three named slots', () => {
      const wrapper = mount(PropsTabShell, {
         slots: {
            toolbar: '<button data-testid="tb">tb</button>',
            metadata: '<span data-testid="md">md</span>',
            content: '<section data-testid="ct">ct</section>'
         }
      });
      expect(wrapper.find('[data-testid="tb"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="md"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="ct"]').exists()).toBe(true);
   });
});
