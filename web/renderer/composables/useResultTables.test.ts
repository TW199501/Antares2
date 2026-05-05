/**
 * Tests for useResultTables composable.
 *
 * Wraps the result-table imperative API for query result panels:
 * updateField (cell update via Tables.updateTableCell) and deleteSelected
 * (row delete via Tables.deleteTableRows). Both call reloadTable on success
 * paths and push to notifications store on backend error / thrown exception.
 */
import { mountComposable } from '@tests/helpers/mountComposable';
import type { TableDeleteParams, TableUpdateParams } from 'common/interfaces/tableApis';
import { describe, expect, it, vi } from 'vitest';

import Tables from '@/ipc-api/Tables';

import { useResultTables } from './useResultTables';

vi.mock('@/ipc-api/Tables', () => ({
   default: {
      updateTableCell: vi.fn(),
      deleteTableRows: vi.fn()
   }
}));

const reloadTable = vi.fn();

const baseUpdate: TableUpdateParams = {
   primary: 'id',
   schema: 'public',
   table: 't',
   id: 1,
   row: 0,
   field: 'name',
   orgRow: { id: 1, name: 'old' },
   content: 'new',
   type: 'string',
   fields: []
} as unknown as TableUpdateParams;

const baseDelete: TableDeleteParams = {
   primary: 'id',
   schema: 'public',
   table: 't',
   rows: [{ id: 1 }]
} as unknown as TableDeleteParams;

describe('useResultTables', () => {
   describe('initial state', () => {
      it('exposes queryTable ref initialized to null', () => {
         const [api, wrapper] = mountComposable(() => useResultTables('uid-1', reloadTable));
         expect(api.queryTable.value).toBeNull();
         wrapper.unmount();
      });

      it('exposes isQuering ref initialized to false', () => {
         const [api, wrapper] = mountComposable(() => useResultTables('uid-1', reloadTable));
         expect(api.isQuering.value).toBe(false);
         wrapper.unmount();
      });
   });

   describe('updateField', () => {
      it('calls Tables.updateTableCell with merged uid + payload', async () => {
         vi.mocked(Tables.updateTableCell).mockResolvedValueOnce({
            status: 'success',
            response: { reload: false }
         } as never);

         const [api, wrapper] = mountComposable(() => useResultTables('uid-1', reloadTable));
         api.queryTable.value = { applyUpdate: vi.fn() } as never;

         await api.updateField(baseUpdate);
         expect(Tables.updateTableCell).toHaveBeenCalledWith({ uid: 'uid-1', ...baseUpdate });
         wrapper.unmount();
      });

      it('reloads the table when response.reload is true (blob path)', async () => {
         reloadTable.mockClear();
         vi.mocked(Tables.updateTableCell).mockResolvedValueOnce({
            status: 'success',
            response: { reload: true }
         } as never);

         const [api, wrapper] = mountComposable(() => useResultTables('uid-1', reloadTable));
         const applyUpdate = vi.fn();
         api.queryTable.value = { applyUpdate } as never;

         await api.updateField(baseUpdate);
         expect(reloadTable).toHaveBeenCalledTimes(1);
         expect(applyUpdate).not.toHaveBeenCalled();
         wrapper.unmount();
      });

      it('calls applyUpdate when response.reload is false (no reload)', async () => {
         reloadTable.mockClear();
         vi.mocked(Tables.updateTableCell).mockResolvedValueOnce({
            status: 'success',
            response: { reload: false }
         } as never);

         const [api, wrapper] = mountComposable(() => useResultTables('uid-1', reloadTable));
         const applyUpdate = vi.fn();
         api.queryTable.value = { applyUpdate } as never;

         await api.updateField(baseUpdate);
         expect(applyUpdate).toHaveBeenCalledWith(baseUpdate);
         expect(reloadTable).not.toHaveBeenCalled();
         wrapper.unmount();
      });

      it('toggles isQuering true → false across the request lifecycle', async () => {
         vi.mocked(Tables.updateTableCell).mockResolvedValueOnce({
            status: 'success',
            response: { reload: false }
         } as never);

         const [api, wrapper] = mountComposable(() => useResultTables('uid-1', reloadTable));
         api.queryTable.value = { applyUpdate: vi.fn() } as never;

         expect(api.isQuering.value).toBe(false);
         const promise = api.updateField(baseUpdate);
         expect(api.isQuering.value).toBe(true);
         await promise;
         expect(api.isQuering.value).toBe(false);
         wrapper.unmount();
      });

      it('does not throw on backend error status (notification path)', async () => {
         vi.mocked(Tables.updateTableCell).mockResolvedValueOnce({
            status: 'error',
            response: 'boom'
         } as never);

         const [api, wrapper] = mountComposable(() => useResultTables('uid-1', reloadTable));
         api.queryTable.value = { applyUpdate: vi.fn() } as never;

         await expect(api.updateField(baseUpdate)).resolves.toBeUndefined();
         expect(api.isQuering.value).toBe(false);
         wrapper.unmount();
      });

      it('catches thrown exceptions and resets isQuering', async () => {
         vi.mocked(Tables.updateTableCell).mockRejectedValueOnce(new Error('net'));

         const [api, wrapper] = mountComposable(() => useResultTables('uid-1', reloadTable));
         api.queryTable.value = { applyUpdate: vi.fn() } as never;

         await expect(api.updateField(baseUpdate)).resolves.toBeUndefined();
         expect(api.isQuering.value).toBe(false);
         wrapper.unmount();
      });
   });

   describe('deleteSelected', () => {
      it('calls Tables.deleteTableRows with merged uid + payload and reloads on success', async () => {
         reloadTable.mockClear();
         vi.mocked(Tables.deleteTableRows).mockResolvedValueOnce({
            status: 'success',
            response: null
         } as never);

         const [api, wrapper] = mountComposable(() => useResultTables('uid-9', reloadTable));
         await api.deleteSelected(baseDelete);

         expect(Tables.deleteTableRows).toHaveBeenCalledWith({ uid: 'uid-9', ...baseDelete });
         expect(reloadTable).toHaveBeenCalledTimes(1);
         wrapper.unmount();
      });

      it('does NOT reload on backend error status', async () => {
         reloadTable.mockClear();
         vi.mocked(Tables.deleteTableRows).mockResolvedValueOnce({
            status: 'error',
            response: 'cannot delete'
         } as never);

         const [api, wrapper] = mountComposable(() => useResultTables('uid-9', reloadTable));
         await api.deleteSelected(baseDelete);

         expect(reloadTable).not.toHaveBeenCalled();
         expect(api.isQuering.value).toBe(false);
         wrapper.unmount();
      });

      it('catches thrown exceptions and resets isQuering', async () => {
         vi.mocked(Tables.deleteTableRows).mockRejectedValueOnce(new Error('boom'));

         const [api, wrapper] = mountComposable(() => useResultTables('uid-9', reloadTable));
         await expect(api.deleteSelected(baseDelete)).resolves.toBeUndefined();
         expect(api.isQuering.value).toBe(false);
         wrapper.unmount();
      });
   });
});
