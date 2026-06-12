/**
 * Tests for useQueryExecution composable.
 *
 * Encapsulates the SQL query lifecycle: runQuery, commitTab, rollbackTab,
 * killTabQuery, clearResults. Plain string vs Ref inputs (snapshot-only vs
 * live), happy / error / thrown / cancelled paths, isQuering toggling,
 * autocommit branch that gates setUnsavedChanges, and result aggregation
 * (resultsCount / durationsCount / affectedCount).
 */
import { mountComposable } from '@tests/helpers/mountComposable';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import Schema from '@/ipc-api/Schema';

import { useQueryExecution } from './useQueryExecution';

vi.mock('@/ipc-api/Schema', () => ({
   default: {
      rawQuery: vi.fn(),
      killTabQuery: vi.fn(),
      commitTab: vi.fn(),
      rollbackTab: vi.fn()
   }
}));

const baseInput = {
   connectionUid: 'conn-1',
   tabUid: 'tab-1',
   schema: 'public',
   autocommit: true
};

describe('useQueryExecution — initial state', () => {
   it('exposes all expected refs initialized to defaults', () => {
      const [api, wrapper] = mountComposable(() => useQueryExecution(baseInput));

      expect(api.isQuering.value).toBe(false);
      expect(api.isCancelling.value).toBe(false);
      expect(api.results.value).toEqual([]);
      expect(api.resultsCount.value).toBe(0);
      expect(api.durationsCount.value).toBe(0);
      expect(api.affectedCount.value).toBeNull();
      expect(api.lastQuery.value).toBe('');

      wrapper.unmount();
   });
});

describe('useQueryExecution.runQuery — happy path', () => {
   it('aggregates rows, durations and affected rows from a successful response', async () => {
      vi.mocked(Schema.rawQuery).mockResolvedValueOnce({
         status: 'success',
         response: [
            {
               rows: [{ id: 1 }, { id: 2 }],
               duration: 50,
               report: { affectedRows: 0 },
               fields: [],
               keys: []
            },
            {
               rows: [],
               duration: 10,
               report: { affectedRows: 3 },
               fields: [],
               keys: []
            }
         ]
      } as never);

      const [api, wrapper] = mountComposable(() => useQueryExecution(baseInput));
      await api.runQuery('SELECT * FROM t');

      expect(api.results.value).toHaveLength(2);
      expect(api.resultsCount.value).toBe(2);
      expect(api.durationsCount.value).toBe(60);
      expect(api.affectedCount.value).toBe(3);
      expect(api.lastQuery.value).toBe('SELECT * FROM t');
      expect(api.isQuering.value).toBe(false);

      wrapper.unmount();
   });

   it('wraps a single non-array response into a one-element results array', async () => {
      vi.mocked(Schema.rawQuery).mockResolvedValueOnce({
         status: 'success',
         response: {
            rows: [{ id: 1 }],
            duration: 5,
            report: { affectedRows: 1 },
            fields: [],
            keys: []
         }
      } as never);

      const [api, wrapper] = mountComposable(() => useQueryExecution(baseInput));
      await api.runQuery('SELECT 1');

      expect(api.results.value).toHaveLength(1);
      expect(api.resultsCount.value).toBe(1);

      wrapper.unmount();
   });

   it('keeps affectedCount null when no result reports affectedRows', async () => {
      vi.mocked(Schema.rawQuery).mockResolvedValueOnce({
         status: 'success',
         response: [
            {
               rows: [{ id: 1 }],
               duration: 5,
               report: null,
               fields: [],
               keys: []
            }
         ]
      } as never);

      const [api, wrapper] = mountComposable(() => useQueryExecution(baseInput));
      await api.runQuery('SELECT 1');

      expect(api.affectedCount.value).toBeNull();
      wrapper.unmount();
   });

   it('passes unref-ed params (Ref inputs are dereferenced)', async () => {
      vi.mocked(Schema.rawQuery).mockResolvedValueOnce({
         status: 'success',
         response: []
      } as never);

      const connectionUid = ref('conn-live');
      const tabUid = ref('tab-live');
      const schema = ref<string | null>('analytics');
      const autocommit = ref(false);

      const [api, wrapper] = mountComposable(() =>
         useQueryExecution({ connectionUid, tabUid, schema, autocommit })
      );

      await api.runQuery('SELECT 1');

      expect(Schema.rawQuery).toHaveBeenCalledWith({
         uid: 'conn-live',
         schema: 'analytics',
         tabUid: 'tab-live',
         autocommit: false,
         query: 'SELECT 1'
      });
      wrapper.unmount();
   });
});

describe('useQueryExecution.runQuery — guards', () => {
   it('does nothing when query is an empty string', async () => {
      const [api, wrapper] = mountComposable(() => useQueryExecution(baseInput));
      await api.runQuery('');

      expect(Schema.rawQuery).not.toHaveBeenCalled();
      expect(api.isQuering.value).toBe(false);
      wrapper.unmount();
   });

   it('does nothing when already running (re-entrancy guard)', async () => {
      vi.mocked(Schema.rawQuery).mockImplementation(
         () => new Promise(() => {}) as never
      );

      const [api, wrapper] = mountComposable(() => useQueryExecution(baseInput));
      // Fire two concurrent runs without awaiting (intentional — the second
      // must short-circuit). Suppress floating-promise warnings:
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      api.runQuery('SELECT 1');
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      api.runQuery('SELECT 2');

      expect(Schema.rawQuery).toHaveBeenCalledTimes(1);
      wrapper.unmount();
   });

   it('toggles isQuering true while in flight, then false on completion', async () => {
      let resolveCall: (v: unknown) => void;
      vi.mocked(Schema.rawQuery).mockImplementation(
         () =>
            new Promise((resolve) => {
               resolveCall = resolve;
            }) as never
      );

      const [api, wrapper] = mountComposable(() => useQueryExecution(baseInput));
      const promise = api.runQuery('SELECT 1');
      expect(api.isQuering.value).toBe(true);

      resolveCall!({ status: 'success', response: [] });
      await promise;
      expect(api.isQuering.value).toBe(false);
      wrapper.unmount();
   });
});

describe('useQueryExecution.runQuery — selection override', () => {
   it('replaces query with selectedText when executeSelected is true', async () => {
      vi.mocked(Schema.rawQuery).mockResolvedValueOnce({
         status: 'success',
         response: []
      } as never);

      const [api, wrapper] = mountComposable(() =>
         useQueryExecution({
            ...baseInput,
            executeSelected: true,
            getSelectedText: () => 'SELECT 999'
         })
      );

      await api.runQuery('SELECT 1');

      expect(Schema.rawQuery).toHaveBeenCalledWith(
         expect.objectContaining({ query: 'SELECT 999' })
      );
      expect(api.lastQuery.value).toBe('SELECT 999');
      wrapper.unmount();
   });

   it('keeps original query when getSelectedText returns empty', async () => {
      vi.mocked(Schema.rawQuery).mockResolvedValueOnce({
         status: 'success',
         response: []
      } as never);

      const [api, wrapper] = mountComposable(() =>
         useQueryExecution({
            ...baseInput,
            executeSelected: true,
            getSelectedText: () => ''
         })
      );

      await api.runQuery('SELECT 1');

      expect(Schema.rawQuery).toHaveBeenCalledWith(
         expect.objectContaining({ query: 'SELECT 1' })
      );
      wrapper.unmount();
   });

   it('does not call getSelectedText when executeSelected is false', async () => {
      vi.mocked(Schema.rawQuery).mockResolvedValueOnce({
         status: 'success',
         response: []
      } as never);

      const getSelectedText = vi.fn(() => 'IGNORED');
      const [api, wrapper] = mountComposable(() =>
         useQueryExecution({
            ...baseInput,
            executeSelected: false,
            getSelectedText
         })
      );

      await api.runQuery('SELECT 1');

      expect(getSelectedText).not.toHaveBeenCalled();
      wrapper.unmount();
   });
});

describe('useQueryExecution.runQuery — error / thrown', () => {
   it('does not throw on backend error status', async () => {
      vi.mocked(Schema.rawQuery).mockResolvedValueOnce({
         status: 'error',
         response: 'syntax error near WHERE'
      } as never);

      const [api, wrapper] = mountComposable(() => useQueryExecution(baseInput));
      await expect(api.runQuery('BAD SQL')).resolves.toBeUndefined();
      expect(api.isQuering.value).toBe(false);
      // results array stays empty (cleared but never populated)
      expect(api.results.value).toEqual([]);
      wrapper.unmount();
   });

   it('catches thrown exceptions and resets isQuering', async () => {
      vi.mocked(Schema.rawQuery).mockRejectedValueOnce(new Error('net'));

      const [api, wrapper] = mountComposable(() => useQueryExecution(baseInput));
      await expect(api.runQuery('SELECT 1')).resolves.toBeUndefined();
      expect(api.isQuering.value).toBe(false);
      // lastQuery still gets set after the catch — verifies reachability
      expect(api.lastQuery.value).toBe('SELECT 1');
      wrapper.unmount();
   });

   it('clears stale results before each new run', async () => {
      vi.mocked(Schema.rawQuery)
         .mockResolvedValueOnce({
            status: 'success',
            response: [
               {
                  rows: [{ id: 1 }],
                  duration: 10,
                  report: { affectedRows: 1 },
                  fields: [],
                  keys: []
               }
            ]
         } as never)
         .mockResolvedValueOnce({
            status: 'error',
            response: 'fail'
         } as never);

      const [api, wrapper] = mountComposable(() => useQueryExecution(baseInput));
      await api.runQuery('SELECT 1');
      expect(api.results.value).toHaveLength(1);

      await api.runQuery('SELECT 2');
      expect(api.results.value).toEqual([]);
      expect(api.resultsCount.value).toBe(0);
      wrapper.unmount();
   });
});

describe('useQueryExecution.clearResults', () => {
   it('resets results, counts and affected back to defaults', async () => {
      vi.mocked(Schema.rawQuery).mockResolvedValueOnce({
         status: 'success',
         response: [
            {
               rows: [{ id: 1 }],
               duration: 10,
               report: { affectedRows: 1 },
               fields: [],
               keys: []
            }
         ]
      } as never);

      const [api, wrapper] = mountComposable(() => useQueryExecution(baseInput));
      await api.runQuery('SELECT 1');
      expect(api.results.value).toHaveLength(1);

      api.clearResults();
      expect(api.results.value).toEqual([]);
      expect(api.resultsCount.value).toBe(0);
      expect(api.durationsCount.value).toBe(0);
      expect(api.affectedCount.value).toBeNull();
      wrapper.unmount();
   });
});

describe('useQueryExecution.killTabQuery', () => {
   it('calls Schema.killTabQuery with uid + tabUid', async () => {
      vi.mocked(Schema.killTabQuery).mockResolvedValueOnce({
         status: 'success',
         response: null
      } as never);

      const [api, wrapper] = mountComposable(() => useQueryExecution(baseInput));
      await api.killTabQuery();

      expect(Schema.killTabQuery).toHaveBeenCalledWith({
         uid: 'conn-1',
         tabUid: 'tab-1'
      });
      expect(api.isCancelling.value).toBe(false);
      wrapper.unmount();
   });

   it('debounces concurrent calls via isCancelling flag', async () => {
      let resolveCall: () => void;
      vi.mocked(Schema.killTabQuery).mockImplementation(
         () =>
            new Promise<void>((resolve) => {
               resolveCall = resolve;
            }) as never
      );

      const [api, wrapper] = mountComposable(() => useQueryExecution(baseInput));
      const first = api.killTabQuery();
      const second = api.killTabQuery();

      expect(Schema.killTabQuery).toHaveBeenCalledTimes(1);

      resolveCall!();
      await Promise.all([first, second]);
      wrapper.unmount();
   });

   it('catches thrown errors and resets isCancelling', async () => {
      vi.mocked(Schema.killTabQuery).mockRejectedValueOnce(new Error('boom'));

      const [api, wrapper] = mountComposable(() => useQueryExecution(baseInput));
      await expect(api.killTabQuery()).resolves.toBeUndefined();
      expect(api.isCancelling.value).toBe(false);
      wrapper.unmount();
   });
});

describe('useQueryExecution.commitTab', () => {
   it('returns true on success', async () => {
      vi.mocked(Schema.commitTab).mockResolvedValueOnce({
         status: 'success',
         response: null
      } as never);

      const [api, wrapper] = mountComposable(() => useQueryExecution(baseInput));
      const result = await api.commitTab();
      expect(result).toBe(true);
      expect(api.isQuering.value).toBe(false);
      wrapper.unmount();
   });

   it('returns false on backend error status', async () => {
      vi.mocked(Schema.commitTab).mockResolvedValueOnce({
         status: 'error',
         response: 'cannot commit'
      } as never);

      const [api, wrapper] = mountComposable(() => useQueryExecution(baseInput));
      const result = await api.commitTab();
      expect(result).toBe(false);
      expect(api.isQuering.value).toBe(false);
      wrapper.unmount();
   });

   it('returns false on thrown exception', async () => {
      vi.mocked(Schema.commitTab).mockRejectedValueOnce(new Error('net'));

      const [api, wrapper] = mountComposable(() => useQueryExecution(baseInput));
      const result = await api.commitTab();
      expect(result).toBe(false);
      expect(api.isQuering.value).toBe(false);
      wrapper.unmount();
   });

   it('passes unref-ed identifiers when called with refs', async () => {
      vi.mocked(Schema.commitTab).mockResolvedValueOnce({
         status: 'success',
         response: null
      } as never);

      const connectionUid = ref('c-x');
      const tabUid = ref('t-x');
      const [api, wrapper] = mountComposable(() =>
         useQueryExecution({
            connectionUid,
            tabUid,
            schema: null,
            autocommit: true
         })
      );
      await api.commitTab();

      expect(Schema.commitTab).toHaveBeenCalledWith({ uid: 'c-x', tabUid: 't-x' });
      wrapper.unmount();
   });
});

describe('useQueryExecution.rollbackTab', () => {
   it('returns true on success', async () => {
      vi.mocked(Schema.rollbackTab).mockResolvedValueOnce({
         status: 'success',
         response: null
      } as never);

      const [api, wrapper] = mountComposable(() => useQueryExecution(baseInput));
      const result = await api.rollbackTab();
      expect(result).toBe(true);
      expect(api.isQuering.value).toBe(false);
      wrapper.unmount();
   });

   it('returns false on backend error status', async () => {
      vi.mocked(Schema.rollbackTab).mockResolvedValueOnce({
         status: 'error',
         response: 'cannot rollback'
      } as never);

      const [api, wrapper] = mountComposable(() => useQueryExecution(baseInput));
      const result = await api.rollbackTab();
      expect(result).toBe(false);
      wrapper.unmount();
   });

   it('returns false on thrown exception', async () => {
      vi.mocked(Schema.rollbackTab).mockRejectedValueOnce(new Error('net'));

      const [api, wrapper] = mountComposable(() => useQueryExecution(baseInput));
      const result = await api.rollbackTab();
      expect(result).toBe(false);
      wrapper.unmount();
   });
});
