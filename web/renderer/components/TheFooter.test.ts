/**
 * Tests for TheFooter — the bottom status-bar layout component.
 *
 * Status bar reads from connections / workspaces / application stores. The
 * version string is derived from the *active workspace* version object, which
 * starts unset, so a vanilla mount yields an empty version. Tests cover:
 *   - mounts cleanly under default state
 *   - renders #footer wrapper + a default accent color (brand #FF5000)
 *   - clicking the console row triggers without error
 *   - bug icon row renders with the right title attribute
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { describe, expect, it, vi } from 'vitest';

import TheFooter from './TheFooter.vue';

vi.mock('@tauri-apps/plugin-shell', () => ({
   open: vi.fn(async () => {})
}));

const mountFooter = (initialState: Record<string, unknown> = {}) =>
   mountWithPinia(TheFooter, {
      initialState,
      global: {
         stubs: {
            BaseIcon: true,
            DropdownMenu: true,
            DropdownMenuTrigger: true,
            DropdownMenuContent: true,
            DropdownMenuItem: true
         }
      }
   });

describe('TheFooter', () => {
   it('mounts without throwing under default Pinia state', () => {
      expect(() => mountFooter()).not.toThrow();
   });

   it('renders the #footer root element', () => {
      const wrapper = mountFooter();
      expect(wrapper.find('#footer').exists()).toBe(true);
   });

   it('falls back to brand primary #FF5000 when no folder color is set', () => {
      const wrapper = mountFooter();
      const root = wrapper.find('#footer');
      // happy-dom normalizes hex to rgb(...) when reading style attribute
      expect(root.attributes('style')).toMatch(/(?:#FF5000|rgb\(255,\s*80,\s*0\))/i);
   });

   it('writes --primary-color CSS var to :root on mount', () => {
      mountFooter();
      const value = document.documentElement.style.getPropertyValue('--primary-color');
      expect(value).toBeTruthy();
   });

   it('does not render the SSL / SSH chips when no connection is selected', () => {
      const wrapper = mountFooter();
      expect(wrapper.text()).not.toContain('SSL');
      expect(wrapper.text()).not.toContain('SSH');
   });

   it('renders the bug-report row with reportABug title', () => {
      const wrapper = mountFooter();
      const bugLi = wrapper.find('li[title="application.reportABug"]');
      expect(bugLi.exists()).toBe(true);
   });

   it('clicking the console row does not throw', async () => {
      const wrapper = mountFooter();
      const consoleLink = wrapper.findAll('.footer-link')[0];
      expect(consoleLink.exists()).toBe(true);
      await expect(consoleLink.trigger('click')).resolves.not.toThrow();
   });

   it('renders the about row with the about title attribute', () => {
      const wrapper = mountFooter();
      const aboutLi = wrapper.find('li[title="application.about"]');
      expect(aboutLi.exists()).toBe(true);
   });
});
