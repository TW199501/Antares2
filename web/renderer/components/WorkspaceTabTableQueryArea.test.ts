/**
 * Smoke tests for WorkspaceTabTableQueryArea.vue — minimal placeholder
 * banner that fills the query-area slot of a Table tab while no query is
 * yet typed. Pure i18n string + layout classes.
 *
 * Locked contracts:
 *   - is exported / defined
 *   - mounts without throwing
 *   - root element is a <div>
 *   - renders the i18n placeholder key
 *   - root has the expected layout classes
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import WorkspaceTabTableQueryArea from './WorkspaceTabTableQueryArea.vue';

describe('WorkspaceTabTableQueryArea', () => {
   it('is exported and defined', () => {
      expect(WorkspaceTabTableQueryArea).toBeDefined();
   });

   it('mounts without throwing', () => {
      expect(() => mount(WorkspaceTabTableQueryArea)).not.toThrow();
   });

   it('root element is a div', () => {
      const wrapper = mount(WorkspaceTabTableQueryArea);
      expect(wrapper.element.tagName.toLowerCase()).toBe('div');
   });

   it('renders the i18n placeholder key', () => {
      const wrapper = mount(WorkspaceTabTableQueryArea);
      expect(wrapper.text()).toContain('database.queryAreaPlaceholder');
   });

   it('root has the expected layout classes', () => {
      const wrapper = mount(WorkspaceTabTableQueryArea);
      const cls = wrapper.element.className;
      expect(cls).toContain('flex');
      expect(cls).toContain('items-center');
      expect(cls).toContain('justify-center');
   });
});
