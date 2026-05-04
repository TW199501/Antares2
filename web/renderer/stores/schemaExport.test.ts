/**
 * schemaExport store — Pinia store tests (T11 / PR5).
 *
 * Tested behaviors:
 *   - Default state: modal closed, schema/table undefined
 *   - showExportModal(): opens modal, captures schema/table args
 *   - showExportModal() with no args: opens modal, schema/table stay undefined
 *   - hideExportModal(): closes modal AND resets schema/table to undefined
 *     (important — guards against stale selection on next open)
 */
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSchemaExportStore } from './schemaExport';

describe('schemaExport store', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('starts with modal closed and selection undefined', () => {
      const store = useSchemaExportStore();
      expect(store.isExportModal).toBe(false);
      expect(store.selectedSchema).toBeUndefined();
      expect(store.selectedTable).toBeUndefined();
   });

   it('showExportModal(schema, table) records both values and opens the modal', () => {
      const store = useSchemaExportStore();
      store.showExportModal('public', 'users');
      expect(store.isExportModal).toBe(true);
      expect(store.selectedSchema).toBe('public');
      expect(store.selectedTable).toBe('users');
   });

   it('showExportModal(schema) — table stays undefined for whole-schema export', () => {
      const store = useSchemaExportStore();
      store.showExportModal('public');
      expect(store.isExportModal).toBe(true);
      expect(store.selectedSchema).toBe('public');
      expect(store.selectedTable).toBeUndefined();
   });

   it('showExportModal() with no args — opens modal with no selection', () => {
      const store = useSchemaExportStore();
      store.showExportModal();
      expect(store.isExportModal).toBe(true);
      expect(store.selectedSchema).toBeUndefined();
      expect(store.selectedTable).toBeUndefined();
   });

   it('hideExportModal() closes the modal AND clears schema + table (no stale selection)', () => {
      const store = useSchemaExportStore();
      store.showExportModal('public', 'users');
      store.hideExportModal();
      expect(store.isExportModal).toBe(false);
      expect(store.selectedSchema).toBeUndefined();
      expect(store.selectedTable).toBeUndefined();
   });
});
