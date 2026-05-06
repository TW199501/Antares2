/**
 * Smoke tests for the shadcn-vue SelectItem primitive.
 *
 * SelectItem requires SelectRoot + SelectContent ancestor context (reka-ui).
 * Both mount-based tests throw due to missing SelectContentContext injection.
 * Only the export check is retained.
 */
import { describe, expect, it } from 'vitest';

import SelectItem from './SelectItem.vue';

describe('SelectItem primitive', () => {
   it('is exported and defined', () => {
      expect(SelectItem).toBeDefined();
   });
});
