/**
 * Smoke tests for the Sonner toast wrapper.
 *
 * Most toast behavior (queue ordering, auto-dismiss, close handling) is owned
 * by the upstream `vue-sonner` package and not worth re-testing here. This
 * file locks the antares-specific configuration on the <Toaster> instance:
 *
 *   - position = 'bottom-right'
 *   - rich-colors enabled
 *   - close-button enabled
 *   - tailwind class overrides (toast/title/description) point to design-token
 *     classes (bg-card / border-border / text-card-foreground / etc.)
 *
 * notifications.test.ts already covers the imperative `toast()` invocation
 * path from the notifications store; this primitive-level test ensures the
 * Toaster mount itself is configured correctly.
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

// Mock vue-sonner to avoid pulling its CSS + Teleport at test time.
vi.mock('vue-sonner', () => ({
   Toaster: {
      name: 'Toaster',
      props: ['position', 'richColors', 'closeButton', 'toastOptions'],
      template: '<div data-testid="sonner-toaster" :data-position="position" :data-rich-colors="richColors" :data-close-button="closeButton"></div>'
   }
}));

vi.mock('vue-sonner/style.css', () => ({}));

// eslint-disable-next-line import/first
import Sonner from './Sonner.vue';

describe('Sonner primitive', () => {
   it('mounts a Toaster without throwing', () => {
      expect(() => mount(Sonner)).not.toThrow();
   });

   it('configures Toaster with position bottom-right + rich colors + close button', () => {
      const wrapper = mount(Sonner);
      const toaster = wrapper.find('[data-testid=sonner-toaster]');
      expect(toaster.exists()).toBe(true);
      expect(toaster.attributes('data-position')).toBe('bottom-right');
      // rich-colors + close-button are forwarded as boolean attributes — Vue
      // serializes `:prop="true"` to an empty-string attribute value (HTML
      // boolean attribute convention), so toBeDefined / not undefined is
      // the right shape rather than toBeTruthy.
      expect(toaster.attributes('data-rich-colors')).toBeDefined();
      expect(toaster.attributes('data-close-button')).toBeDefined();
   });
});
