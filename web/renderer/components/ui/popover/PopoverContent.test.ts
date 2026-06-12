/**
 * Smoke tests for the shadcn-vue PopoverContent primitive.
 *
 * PopoverContent uses PopoverPortal + PopoverContent from reka-ui and
 * requires a PopoverRoot context. Tests wrap with the local Popover.vue.
 * Content is only rendered by reka-ui when open=true.
 *
 * Locked contracts:
 *   - is exported and defined
 *   - mounts inside PopoverRoot without throwing (open=false)
 *   - mounts inside open PopoverRoot without throwing (open=true)
 *   - applies z-50 w-72 rounded-md default classes when open
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Popover from './Popover.vue';
import PopoverContent from './PopoverContent.vue';
import PopoverTrigger from './PopoverTrigger.vue';

function mountFull (open = true, extraClass = '') {
   return mount(Popover, {
      props: { open },
      attachTo: document.body,
      slots: {
         default: `
            <PopoverTrigger><button>Open</button></PopoverTrigger>
            <PopoverContent class="${extraClass}"><div data-testid="content-body">body</div></PopoverContent>
         `
      },
      global: { components: { PopoverTrigger, PopoverContent } }
   });
}

describe('PopoverContent primitive', () => {
   it('is exported and defined', () => {
      expect(PopoverContent).toBeDefined();
   });

   it('mounts inside closed PopoverRoot without throwing', () => {
      expect(() => mountFull(false)).not.toThrow();
   });

   it('mounts inside open PopoverRoot without throwing', () => {
      expect(() => mountFull(true)).not.toThrow();
   });

   it('applies z-50 and w-72 default classes when open', () => {
      mountFull(true);
      // PopoverContent teleports to body — inspect document.body
      expect(document.body.innerHTML).toContain('z-50');
      expect(document.body.innerHTML).toContain('w-72');
   });
});
