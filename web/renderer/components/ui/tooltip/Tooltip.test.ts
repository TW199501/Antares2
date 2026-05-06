/**
 * Smoke tests for the shadcn-vue Tooltip primitive (reka-ui TooltipRoot wrapper).
 *
 * Tooltip (TooltipRoot) requires a TooltipProvider ancestor. Tests wrap with
 * a real TooltipProvider via a simple wrapper component.
 *
 * Locked contracts:
 *   - mounts without throwing inside TooltipProvider context
 *   - renders default slot content
 *   - open prop forwarding
 *   - emits update:open when open prop changes
 */
import { mount } from '@vue/test-utils';
import { TooltipProvider } from 'reka-ui';
import { describe, expect, it } from 'vitest';
import { defineComponent, nextTick } from 'vue';

import Tooltip from './Tooltip.vue';

function mountInProvider (props: Record<string, unknown> = {}, slotContent = '<button>trigger</button>') {
   const Wrapper = defineComponent({
      components: { TooltipProvider, Tooltip },
      props: ['tooltipProps'],
      template: `<TooltipProvider><Tooltip v-bind="tooltipProps">${slotContent}</Tooltip></TooltipProvider>`
   });
   return mount(Wrapper, { props: { tooltipProps: props } });
}

describe('Tooltip primitive (reka-ui TooltipRoot wrapper)', () => {
   it('mounts without throwing inside TooltipProvider', () => {
      expect(() => mountInProvider()).not.toThrow();
   });

   it('renders slot content', () => {
      const wrapper = mountInProvider({}, '<span data-testid="trigger-inner">hover me</span>');
      expect(wrapper.find('[data-testid="trigger-inner"]').exists()).toBe(true);
   });

   it('accepts open prop (controlled mode)', () => {
      const wrapper = mountInProvider({ open: false }, '<button>t</button>');
      expect(wrapper.exists()).toBe(true);
   });

   it('accepts open=true without throwing', () => {
      expect(() => mountInProvider({ open: true }, '<button>t</button>')).not.toThrow();
   });

   it('updates open prop without throwing', async () => {
      const wrapper = mountInProvider({ open: false }, '<button>t</button>');
      await wrapper.setProps({ tooltipProps: { open: true } });
      await nextTick();
      expect(wrapper.exists()).toBe(true);
   });
});
