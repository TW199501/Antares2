/**
 * Tests for App.vue — the root layout shell.
 *
 * App.vue uses defineAsyncComponent for almost every direct child. We mount
 * the SUT and immediately assert on the synchronous outer markup (#wrapper +
 * theme class), which is the only contract the parent shell really owns —
 * everything else is delegated. Async children remain unresolved during the
 * test and render as <!---->; flushPromises is fine but not required for the
 * #wrapper assertions because the wrapper's class binding does not depend on
 * the children being resolved.
 *
 * Tests:
 *   - applies theme-light / theme-dark on #wrapper based on settings store
 *   - mirrors the active theme class onto <html> (the documented watcher)
 *   - .no-blur is appended when settings.disableBlur is true
 */
// App.vue's defineAsyncComponent kicks off real dynamic imports even though
// the rendered child is later replaced by a stub. Some of those imports pull
// heavy transitive deps (ace-builds inside BaseTextEditor; the full settings
// modal tree; the workspace panel that loads BaseUploadInput / DebugConsole /
// many other SFCs). Their async resolution races past the test teardown and
// surfaces as "Cannot load X after the environment was torn down" unhandled
// rejections. Mock each async import target with an inline no-op SFC.
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/app', () => ({
   getVersion: vi.fn(async () => 'test')
}));
vi.mock('@/components/BaseTextEditor.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/Workspace.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/WorkspaceAddConnectionPanel.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/ModalSettings.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/ModalAllConnections.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/ModalExportSchema.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/TheTitleBar.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/TheFooter.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/TheScratchpad.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/TheSpecSnapInspector.vue', () => ({ default: { render: () => null } }));
vi.mock('@/components/TheSettingBar.vue', () => ({ default: { render: () => null } }));

// eslint-disable-next-line import/first
import App from '@/App.vue';

const mountApp = (initialState: Record<string, unknown> = {}) =>
   mountWithPinia(App, {
      initialState,
      global: {
         stubs: {
            // The 11 defineAsyncComponent children are auto-stubbed by name
            // when listed here. Reka's TooltipProvider is replaced with a
            // pass-through so the slot tree still mounts.
            TooltipProvider: { template: '<div><slot /></div>' },
            Sonner: true,
            TheTitleBar: true,
            TheFooter: true,
            TheSettingBar: true,
            Workspace: true,
            WorkspaceAddConnectionPanel: true,
            ModalSettings: true,
            ModalAllConnections: true,
            ModalExportSchema: true,
            TheScratchpad: true,
            TheSpecSnapInspector: true,
            BaseTextEditor: true
         }
      }
   });

describe('App.vue — theme class wiring', () => {
   it.each([
      ['light', 'theme-light'],
      ['dark', 'theme-dark']
   ])('applies %s theme class on #wrapper', async (theme, expectedClass) => {
      const wrapper = mountApp({
         settings: { applicationTheme: theme }
      });
      await flushPromises();
      expect(wrapper.find('#wrapper').classes()).toContain(expectedClass);
   });

   it('mirrors the active theme class onto <html>', async () => {
      mountApp({ settings: { applicationTheme: 'dark' } });
      await flushPromises();
      // The watcher uses { immediate: true } so it fires on mount.
      expect(document.documentElement.classList.contains('theme-dark')).toBe(true);
   });

   it('renders #wrapper as the root content container', () => {
      const wrapper = mountApp();
      expect(wrapper.find('#wrapper').exists()).toBe(true);
   });

   it('adds .no-blur on #wrapper when disableBlur is true', async () => {
      const wrapper = mountApp({
         settings: { applicationTheme: 'light', disableBlur: true }
      });
      await flushPromises();
      // Template uses `!disableBlur || 'no-blur'` — true blur returns the
      // string 'no-blur', false returns the boolean (no class added).
      expect(wrapper.find('#wrapper').classes()).toContain('no-blur');
   });
});
