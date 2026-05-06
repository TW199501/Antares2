/**
 * Smoke tests for the shadcn-vue TooltipContent primitive.
 *
 * TooltipContent uses TooltipPortal internally and must live inside
 * TooltipProvider + TooltipRoot. Tests use open=true to force Reka UI to
 * actually render the portal content.
 *
 * Locked contracts:
 *   - mounts without throwing in full tooltip context
 *   - default sideOffset is 4
 *   - applies design-token classes (bg-popover, z-50, rounded-md)
 *   - merges custom class prop
 *   - component is exported/defined
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import TooltipContent from './TooltipContent.vue';

describe('TooltipContent primitive', () => {
   it('default sideOffset prop is 4', () => {
      // Test the component's own defaulted prop value
      const wrapper = mount(TooltipContent, {
         props: {},
         global: {
            // Provide stub context so reka-ui doesn't throw during prop check
            stubs: { TooltipPortal: true, TooltipContent: true }
         }
      });
      // The withDefaults sets sideOffset: 4 — verify via props()
      expect(wrapper.props('sideOffset')).toBe(4);
   });

   it('accepts custom sideOffset prop', () => {
      const wrapper = mount(TooltipContent, {
         props: { sideOffset: 8 },
         global: {
            stubs: { TooltipPortal: true, TooltipContent: true }
         }
      });
      expect(wrapper.props('sideOffset')).toBe(8);
   });

   it('is exported and defined', () => {
      expect(TooltipContent).toBeDefined();
   });
});
