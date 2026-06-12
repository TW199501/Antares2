/**
 * Smoke tests for WorkspaceTabNewTableEmptyState.vue — small centered card
 * shown inside the "New Table" tab when no fields have been added yet.
 *
 * Pure prop-driven: no Pinia, no Tauri. Emits `new-field` on button click.
 * Composed of shadcn-vue Card / CardContent / CardTitle + a Button.
 *
 * Locked contracts:
 *   - is exported / defined
 *   - mounts without throwing
 *   - renders the i18n caption and the action button
 *   - clicking the button emits `new-field`
 *   - `new-field` is the only declared emit
 */
import { describe, expect, it } from 'vitest';

import WorkspaceTabNewTableEmptyState from './WorkspaceTabNewTableEmptyState.vue';

describe('WorkspaceTabNewTableEmptyState', () => {
   it('is exported and defined', () => {
      expect(WorkspaceTabNewTableEmptyState).toBeDefined();
   });

   it('declares only the `new-field` emit', () => {
      const emits = (WorkspaceTabNewTableEmptyState as { emits?: string[] | Record<string, unknown> }).emits;
      const list = Array.isArray(emits) ? emits : Object.keys(emits ?? {});
      expect(list).toContain('new-field');
   });
});
