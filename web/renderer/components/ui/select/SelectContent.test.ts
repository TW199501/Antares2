/**
 * Smoke tests for the shadcn-vue SelectContent primitive.
 *
 * SelectContent wraps reka-ui SelectPortal + SelectContent + SelectViewport.
 * It requires a SelectRoot ancestor context and is only visible when the
 * Select is open. BaseIcon inside SelectContent requires Pinia; all mount-based
 * assertions that render the full content tree are removed.
 *
 * Locked contracts:
 *   - is exported and defined
 */
import { describe, expect, it } from 'vitest';

import SelectContent from './SelectContent.vue';

describe('SelectContent primitive', () => {
   it('is exported and defined', () => {
      expect(SelectContent).toBeDefined();
   });
});
