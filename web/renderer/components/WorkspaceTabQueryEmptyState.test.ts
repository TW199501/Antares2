/**
 * Smoke tests for WorkspaceTabQueryEmptyState.vue — the placeholder shown in
 * an empty Query tab listing the keyboard shortcuts whose `context === 'tab'`.
 *
 * Depends on: useSettingsStore.shortcuts (Pinia), useFilters().parseKeys,
 * vue-i18n (mocked identity), shortcutEvents map.
 *
 * Locked contracts:
 *   - mounts without throwing under empty shortcut list
 *   - renders one row per filtered shortcut
 *   - non-tab-context shortcuts are filtered out
 *   - i18n key for each tab-context shortcut is present in DOM
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { describe, expect, it } from 'vitest';

import WorkspaceTabQueryEmptyState from './WorkspaceTabQueryEmptyState.vue';

const tabShortcut = {
   event: 'open-new-tab',
   keys: ['Ctrl', 'T']
};

const mainShortcut = {
   event: 'setZoomIn',
   keys: ['Ctrl', '+']
};

describe('WorkspaceTabQueryEmptyState', () => {
   it('is exported and defined', () => {
      expect(WorkspaceTabQueryEmptyState).toBeDefined();
   });

   it('mounts without throwing under an empty shortcut list', () => {
      expect(() =>
         mountWithPinia(WorkspaceTabQueryEmptyState, {
            initialState: { settings: { shortcuts: [] } }
         })
      ).not.toThrow();
   });

   it('renders one row pair per tab-context shortcut', () => {
      const wrapper = mountWithPinia(WorkspaceTabQueryEmptyState, {
         initialState: {
            settings: { shortcuts: [tabShortcut, { ...tabShortcut, event: 'close-tab', keys: ['Ctrl', 'W'] }] }
         }
      });
      // 2 columns × 2 shortcuts = 4 .mb-4 rows
      const rows = wrapper.findAll('.mb-4');
      expect(rows.length).toBe(4);
   });

   it('filters out non-tab-context shortcuts', () => {
      const wrapper = mountWithPinia(WorkspaceTabQueryEmptyState, {
         initialState: {
            settings: { shortcuts: [tabShortcut, mainShortcut] }
         }
      });
      const html = wrapper.html();
      // tab-context i18n key must appear; main-context must not
      expect(html).toContain('application.openNewTab');
      expect(html).not.toContain('application.zoomIn');
   });

   it('renders the .container root with grid layout', () => {
      const wrapper = mountWithPinia(WorkspaceTabQueryEmptyState, {
         initialState: { settings: { shortcuts: [] } }
      });
      expect(wrapper.find('.container').exists()).toBe(true);
      expect(wrapper.find('.grid-cols-2').exists()).toBe(true);
   });
});
