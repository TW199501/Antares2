/**
 * Tests for BaseIcon.
 *
 * Wraps @jamescoyle/vue-icon's <SvgIcon> for the default `mdi` type and a
 * raw inline <svg> for `custom` icons (loaded as base64 via connections
 * store). We exercise: SVG rendering, size + rotate forwarding, the flip
 * class computed binding, and graceful fallback for unknown mdi names.
 * NOTE: We never assert the SVG path string itself — @mdi/js path values
 * shift silently between minor versions.
 */
import { createTestingPinia } from '@pinia/testing';
import { mount as vtuMount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import BaseIcon from './BaseIcon.vue';

// BaseIcon's setup() calls useConnectionsStore() at module evaluation time,
// so an active Pinia must be installed for every mount. Using mountWithPinia
// loses the prop generic through its Omit<...> wrapper and produces TS2322
// errors at every call site, so we install Pinia inline instead.
const mountIcon = (
   props: Record<string, unknown> = {},
   piniaInitialState: Record<string, unknown> = {}
) => {
   const pinia = createTestingPinia({
      stubActions: false,
      initialState: piniaInitialState,
      createSpy: vi.fn
   });
   return vtuMount(BaseIcon, {
      props: props as never,
      global: { plugins: [pinia] }
   });
};

describe('BaseIcon', () => {
   it('mounts with a known mdi icon without throwing', () => {
      expect(() => mountIcon({ iconName: 'mdiAccount' })).not.toThrow();
   });

   it('renders a path-bearing SvgIcon for mdi type', () => {
      const wrapper = mountIcon({ iconName: 'mdiAccount', size: 24 });
      const svg = wrapper.find('svg');
      expect(svg.exists()).toBe(true);
      // @jamescoyle/vue-icon outputs a single <path d="..." />; we check the
      // element exists, NOT its `d` value (that drifts with @mdi/js upgrades).
      expect(svg.find('path').exists()).toBe(true);
   });

   it('forwards size to the rendered SVG', () => {
      const wrapper = mountIcon({ iconName: 'mdiAccount', size: 32 });
      const svg = wrapper.find('svg');
      expect(svg.attributes('width')).toBe('32');
      expect(svg.attributes('height')).toBe('32');
   });

   it('uses default size 48 when size prop is omitted', () => {
      const wrapper = mountIcon({ iconName: 'mdiAccount' });
      const svg = wrapper.find('svg');
      expect(svg.attributes('width')).toBe('48');
      expect(svg.attributes('height')).toBe('48');
   });

   it('does not throw when the mdi icon name is unknown', () => {
      // @mdi/js will not have this key — iconPath becomes undefined, but the
      // template still renders the SvgIcon wrapper without error.
      expect(() => mountIcon({ iconName: 'mdiTotallyMadeUpIconName' })).not.toThrow();
   });

   describe('flip prop → class mapping', () => {
      it('applies flip-horizontal class', () => {
         const wrapper = mountIcon({ iconName: 'mdiAccount', flip: 'horizontal' });
         expect(wrapper.html()).toContain('flip-horizontal');
      });

      it('applies flip-vertical class', () => {
         const wrapper = mountIcon({ iconName: 'mdiAccount', flip: 'vertical' });
         expect(wrapper.html()).toContain('flip-vertical');
      });

      it('applies flip-both class', () => {
         const wrapper = mountIcon({ iconName: 'mdiAccount', flip: 'both' });
         expect(wrapper.html()).toContain('flip-both');
      });

      it('applies no flip-* class when flip is null', () => {
         const wrapper = mountIcon({ iconName: 'mdiAccount' });
         const html = wrapper.html();
         expect(html).not.toContain('flip-horizontal');
         expect(html).not.toContain('flip-vertical');
         expect(html).not.toContain('flip-both');
      });
   });

   it('forwards rotate prop to the SvgIcon (default mdi branch)', () => {
      // rotate is a number passed through to SvgIcon — we just assert the
      // component still renders an svg without error when set.
      const wrapper = mountIcon({ iconName: 'mdiAccount', rotate: 90 });
      expect(wrapper.find('svg').exists()).toBe(true);
   });

   it('renders the raw svg branch for type="custom" with base64 content from store', () => {
      const fakeSvg = '<rect width="48" height="48" fill="red" />';
      const base64 = Buffer.from(fakeSvg, 'utf-8').toString('base64');

      const wrapper = mountIcon(
         { iconName: 'icon-uid-1', type: 'custom', size: 64 },
         { connections: { customIcons: [{ uid: 'icon-uid-1', base64 }] } }
      );

      const svg = wrapper.find('svg');
      expect(svg.exists()).toBe(true);
      expect(svg.attributes('width')).toBe('64');
      expect(svg.attributes('height')).toBe('64');
      // viewBox uses size for both dims
      expect(svg.attributes('viewBox')).toBe('0 0 64 64');
      // v-html injects the decoded SVG — child <rect> should now exist
      expect(svg.find('rect').exists()).toBe(true);
   });
});
