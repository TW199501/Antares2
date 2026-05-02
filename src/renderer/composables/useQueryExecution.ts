/**
 * useQueryExecution — composable that encapsulates the SQL execution lifecycle:
 * run / commit / rollback / kill.
 *
 * Consumers:
 *   - ModalQueryBuilder (Task 4, Phase 1 — primary driver for extraction)
 *   - WorkspaceTabQuery (Phase 2, future refactor — currently uses its own inline copy)
 *
 * Intentionally NOT included:
 *   - History saving (`saveHistory`) — WorkspaceTabQuery-local; caller hooks in via onSuccess
 *   - Ace editor coupling (`getSelectedText`) — routed via optional callback only
 *   - i18n (`useI18n`) — commit/rollback success notifications are caller responsibility
 */

import { QueryResult } from 'common/interfaces/antares';
import { type Ref, ref, unref } from 'vue';

import Schema from '@/ipc-api/Schema';
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';

export interface UseQueryExecutionInput {
   /** UID of the active connection. Accepts a plain string or a Ref<string>. */
   connectionUid: Ref<string> | string;
   /** UID of the tab making the request. Accepts a plain string or a Ref<string>. */
   tabUid: Ref<string> | string;
   /** Currently selected schema (may be null). */
   schema: Ref<string | null> | string | null;
   /** Whether the connection is in autocommit mode. */
   autocommit: Ref<boolean> | boolean;
   /**
    * If true, `runQuery` will replace the provided query string with the
    * text currently selected in the Ace editor (obtained via `getSelectedText`).
    * Optional — modal callers that have no Ace editor omit this.
    */
   executeSelected?: Ref<boolean> | boolean;
   /**
    * Callback that returns the Ace editor's currently selected text.
    * Called only when `executeSelected` resolves to true.
    * Optional — modal callers pass undefined.
    */
   getSelectedText?: () => string;
}

export interface UseQueryExecutionReturn {
   // --- reactive state ---
   isQuering: Ref<boolean>;
   isCancelling: Ref<boolean>;
   results: Ref<QueryResult[]>;
   resultsCount: Ref<number>;
   durationsCount: Ref<number>;
   affectedCount: Ref<number | null>;
   lastQuery: Ref<string>;

   // --- actions ---
   runQuery: (query: string) => Promise<void>;
   commitTab: () => Promise<void>;
   rollbackTab: () => Promise<void>;
   killTabQuery: () => Promise<void>;
   clearResults: () => void;
}

export function useQueryExecution (input: UseQueryExecutionInput): UseQueryExecutionReturn {
   const { addNotification } = useNotificationsStore();
   const { setUnsavedChanges } = useWorkspacesStore();

   // --- state ---
   const isQuering = ref(false);
   const isCancelling = ref(false);
   const results: Ref<QueryResult[]> = ref([]);
   const resultsCount = ref(0);
   const durationsCount = ref(0);
   const affectedCount: Ref<number | null> = ref(null);
   const lastQuery = ref('');

   // --- helpers ---
   const clearResults = () => {
      results.value = [];
      resultsCount.value = 0;
      durationsCount.value = 0;
      affectedCount.value = null;
   };

   // --- actions ---

   /**
    * Execute `query` against the current connection.
    *
    * When `input.executeSelected` is true and `input.getSelectedText` returns
    * a non-empty string, the selection replaces the provided query text.
    *
    * Error notifications are emitted directly; success notifications are the
    * caller's responsibility (commit/rollback follow the same contract).
    *
    * TODO: caller can subscribe to runQuery completion to save history
    * (WorkspaceTabQuery uses saveHistory internally; modal omits it for MVP).
    */
   const runQuery = async (query: string): Promise<void> => {
      if (!query || isQuering.value) return;

      isQuering.value = true;

      if (unref(input.executeSelected) && typeof input.getSelectedText === 'function') {
         const selectedText = input.getSelectedText();
         if (selectedText) query = selectedText;
      }

      clearResults();

      try {
         const params = {
            uid: unref(input.connectionUid),
            schema: unref(input.schema),
            tabUid: unref(input.tabUid),
            autocommit: unref(input.autocommit),
            query
         };

         const { status, response } = await Schema.rawQuery(params);

         if (status === 'success') {
            results.value = Array.isArray(response) ? response : [response];
            resultsCount.value = results.value.reduce(
               (acc, curr) => acc + (curr.rows ? curr.rows.length : 0),
               0
            );
            durationsCount.value = results.value.reduce(
               (acc, curr) => acc + curr.duration,
               0
            );
            affectedCount.value = results.value
               .filter(result => result.report !== null)
               .reduce((acc, curr) => {
                  if (acc === null) acc = 0;
                  return acc + (curr.report ? curr.report.affectedRows : 0);
               }, null as number | null);

            if (!unref(input.autocommit)) {
               setUnsavedChanges({
                  uid: unref(input.connectionUid),
                  tUid: unref(input.tabUid),
                  isChanged: true
               });
            }
         }
         else
            addNotification({ status: 'error', message: response });
      }
      catch (err) {
         addNotification({ status: 'error', message: err.stack });
      }

      isQuering.value = false;
      lastQuery.value = query;
   };

   /**
    * Kill the in-progress query on this tab.
    * Debounced via `isCancelling` to prevent double-clicks from firing twice.
    */
   const killTabQuery = async (): Promise<void> => {
      if (isCancelling.value) return;

      isCancelling.value = true;

      try {
         const params = {
            uid: unref(input.connectionUid),
            tabUid: unref(input.tabUid)
         };

         await Schema.killTabQuery(params);
      }
      catch (err) {
         addNotification({ status: 'error', message: err.stack });
      }

      isCancelling.value = false;
   };

   /**
    * Commit the open transaction on this tab.
    *
    * Clears the unsaved-changes flag on success.
    * The caller is responsible for showing a success notification and any
    * i18n string (this keeps the composable free of vue-i18n).
    */
   const commitTab = async (): Promise<void> => {
      isQuering.value = true;

      try {
         const params = {
            uid: unref(input.connectionUid),
            tabUid: unref(input.tabUid)
         };

         await Schema.commitTab(params);

         setUnsavedChanges({
            uid: unref(input.connectionUid),
            tUid: unref(input.tabUid),
            isChanged: false
         });
      }
      catch (err) {
         addNotification({ status: 'error', message: err.stack });
      }

      isQuering.value = false;
   };

   /**
    * Roll back the open transaction on this tab.
    *
    * Clears the unsaved-changes flag on success.
    * The caller is responsible for showing a success notification and any
    * i18n string.
    */
   const rollbackTab = async (): Promise<void> => {
      isQuering.value = true;

      try {
         const params = {
            uid: unref(input.connectionUid),
            tabUid: unref(input.tabUid)
         };

         await Schema.rollbackTab(params);

         setUnsavedChanges({
            uid: unref(input.connectionUid),
            tUid: unref(input.tabUid),
            isChanged: false
         });
      }
      catch (err) {
         addNotification({ status: 'error', message: err.stack });
      }

      isQuering.value = false;
   };

   return {
      // state
      isQuering,
      isCancelling,
      results,
      resultsCount,
      durationsCount,
      affectedCount,
      lastQuery,

      // actions
      runQuery,
      commitTab,
      rollbackTab,
      killTabQuery,
      clearResults
   };
}
