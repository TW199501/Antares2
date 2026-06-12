/**
 * workspaces store — Pinia store tests (T10 / PR5).
 *
 * The workspaces store is the largest in the renderer (921 LOC). These tests
 * focus on the critical state machines and edge cases rather than every action.
 *
 * Tested actions / getters / flows:
 *   - addWorkspace / removeWorkspace
 *   - getSelected (3 fallback paths: NEW / explicit selection / lastConnections)
 *   - selectWorkspace
 *   - newTab dispatch (default branch / data-tab dedupe / temp tab → permanent
 *     promotion when isChanged) + selectTab side-effect
 *   - removeTab + checkSelectedTabExists fallback
 *   - removeTabs (multi-tab purge)
 *   - selectNextTab / selectPrevTab wrap-around
 *   - setSearchTerm / setDatabase / changeBreadcrumbs / addLoadedSchema /
 *     addLoadingElement
 *   - setUnsavedChanges
 *   - renameTabs
 *   - removeConnected: calls Connection.disconnect, sets state to 'disconnected'
 *   - connectWorkspace happy path: maps the connect response to structure +
 *     'connected' status, kicks off refresh* secondary fetches
 *   - connectWorkspace error path: status='error' surfaces a notification and
 *     leaves the workspace as 'failed', rejects with the response message
 *   - switchConnection: pre-flips status to 'connecting' before disconnect
 *   - refreshStructure happy / error paths
 *
 * NOT tested here (out of scope for this batch — would explode setup cost
 * without adding behavior coverage):
 *   - The internal tabIndex map's autoincrement across many query tabs
 *   - refreshSchema / refreshCollations / refreshVariables / refreshEngines /
 *     refreshUsers (they share an identical try/catch shape with
 *     refreshStructure, which IS covered)
 *   - newTab cases for every literal type — we cover one default branch, one
 *     dedupe ('data') branch, one temp-promotion branch
 */
import { createTestingPinia } from '@pinia/testing';
import connectFixture from '@tests/fixtures/contract/connection.connect.mssql.happy.json';
import versionFixture from '@tests/fixtures/contract/schema.getVersion.mssql.happy.json';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Connection from '@/ipc-api/Connection';
import Schema from '@/ipc-api/Schema';
import Users from '@/ipc-api/Users';

import { useConnectionsStore } from './connections';
import { useNotificationsStore } from './notifications';
import { useWorkspacesStore, type WorkspaceTab } from './workspaces';

// ─────────────────────────────────────────────────────────────────────
// Mock the IPC wrappers — the store depends on these statically.
// ─────────────────────────────────────────────────────────────────────
vi.mock('@/ipc-api/Connection', () => ({
   default: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      makeTest: vi.fn(),
      abortConnection: vi.fn(),
      checkConnection: vi.fn()
   }
}));

vi.mock('@/ipc-api/Schema', () => ({
   default: {
      getStructure: vi.fn(async () => ({ status: 'success', response: [] })),
      getVersion: vi.fn(async () => ({ status: 'success', response: { number: '0', name: 'Stub', arch: '', os: '' } })),
      getCollations: vi.fn(async () => ({ status: 'success', response: [] })),
      getVariables: vi.fn(async () => ({ status: 'success', response: [] })),
      getEngines: vi.fn(async () => ({ status: 'success', response: [] }))
   }
}));

vi.mock('@/ipc-api/Users', () => ({
   default: {
      getUsers: vi.fn(async () => ({ status: 'success', response: [] }))
   }
}));

// Common helper — seed a workspace row directly on the store.
function seedWorkspace (store: ReturnType<typeof useWorkspacesStore>, partial: Partial<{ uid: string; tabs: WorkspaceTab[]; database: string; status: 'connected' | 'connecting' | 'disconnected' | 'failed'; selectedTab: string }>) {
   store.addWorkspace(partial.uid ?? 'WS1');
   store.workspaces = store.workspaces.map(w => w.uid === (partial.uid ?? 'WS1')
      ? {
         ...w,
         tabs: partial.tabs ?? [],
         database: partial.database ?? '',
         connectionStatus: partial.status ?? 'connected',
         selectedTab: partial.selectedTab ?? '0',
         customizations: { database: true } as never
      }
      : w);
}

describe('workspaces store — defaults & getSelected', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('starts empty', () => {
      const store = useWorkspacesStore();
      expect(store.workspaces).toEqual([]);
      expect(store.selectedWorkspace).toBeNull();
   });

   it('getSelected returns "NEW" when no workspaces exist', () => {
      const store = useWorkspacesStore();
      expect(store.getSelected).toBe('NEW');
   });

   it('getSelected returns selectedWorkspace when explicitly set', () => {
      const store = useWorkspacesStore();
      store.addWorkspace('WS1');
      store.addWorkspace('WS2');
      store.selectWorkspace('WS2');
      expect(store.getSelected).toBe('WS2');
   });

   it('getSelected falls back to most-recent connection from connections store when none selected', () => {
      const store = useWorkspacesStore();
      store.addWorkspace('WS1');
      store.addWorkspace('WS2');
      const connections = useConnectionsStore();
      connections.lastConnections = [
         { uid: 'WS1', time: 100 },
         { uid: 'WS2', time: 999 } // latest
      ];
      expect(store.getSelected).toBe('WS2');
   });

   it('getSelected falls back to first workspace when no lastConnections recorded', () => {
      const store = useWorkspacesStore();
      store.addWorkspace('WSA');
      store.addWorkspace('WSB');
      expect(store.getSelected).toBe('WSA');
   });
});

describe('workspaces store — addWorkspace / removeWorkspace', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('addWorkspace pushes a default-shaped Workspace and removeWorkspace filters it back out', () => {
      const store = useWorkspacesStore();
      store.addWorkspace('WS1');
      const ws = store.getWorkspace('WS1')!;
      expect(ws.uid).toBe('WS1');
      expect(ws.connectionStatus).toBe('disconnected');
      expect(ws.tabs).toEqual([]);
      expect(ws.loadedSchemas instanceof Set).toBe(true);

      store.removeWorkspace('WS1');
      expect(store.workspaces).toEqual([]);
   });

   it('removeWorkspace resets selectedWorkspace to "NEW" when it was the deleted one', () => {
      const store = useWorkspacesStore();
      store.addWorkspace('WS1');
      store.selectWorkspace('WS1');
      store.removeWorkspace('WS1');
      expect(store.selectedWorkspace).toBe('NEW');
   });
});

describe('workspaces store — selectTab / selectNextTab / selectPrevTab', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('selectTab updates selectedTab on the matching workspace', () => {
      const store = useWorkspacesStore();
      seedWorkspace(store, {
         uid: 'WS1',
         tabs: [{ uid: 'T1' } as WorkspaceTab, { uid: 'T2' } as WorkspaceTab],
         selectedTab: 'T1'
      });
      store.selectTab({ uid: 'WS1', tab: 'T2' });
      expect(store.getWorkspace('WS1')!.selectedTab).toBe('T2');
   });

   it('selectNextTab wraps from last tab back to first', () => {
      const store = useWorkspacesStore();
      seedWorkspace(store, {
         uid: 'WS1',
         tabs: [{ uid: 'T1' } as WorkspaceTab, { uid: 'T2' } as WorkspaceTab, { uid: 'T3' } as WorkspaceTab],
         selectedTab: 'T3'
      });
      store.selectNextTab({ uid: 'WS1' });
      expect(store.getWorkspace('WS1')!.selectedTab).toBe('T1');
   });

   it('selectPrevTab wraps from first tab back to last', () => {
      const store = useWorkspacesStore();
      seedWorkspace(store, {
         uid: 'WS1',
         tabs: [{ uid: 'T1' } as WorkspaceTab, { uid: 'T2' } as WorkspaceTab, { uid: 'T3' } as WorkspaceTab],
         selectedTab: 'T1'
      });
      store.selectPrevTab({ uid: 'WS1' });
      expect(store.getWorkspace('WS1')!.selectedTab).toBe('T3');
   });
});

describe('workspaces store — newTab dispatch', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('default branch (e.g. "query"): generates a tab uid, adds it, and selects it', () => {
      const store = useWorkspacesStore();
      seedWorkspace(store, { uid: 'WS1', database: 'master' });

      store.newTab({ uid: 'WS1', type: 'query', content: 'SELECT 1' });

      const ws = store.getWorkspace('WS1')!;
      expect(ws.tabs).toHaveLength(1);
      expect(ws.tabs[0].type).toBe('query');
      expect(ws.tabs[0].content).toBe('SELECT 1');
      expect(ws.tabs[0].database).toBe('master');
      expect(ws.selectedTab).toBe(ws.tabs[0].uid);
   });

   it('"data" branch dedupes: opening a data tab for the same {schema, elementName, elementType} replaces in-place', () => {
      const store = useWorkspacesStore();
      seedWorkspace(store, { uid: 'WS1', database: 'master' });

      store.newTab({ uid: 'WS1', type: 'data', schema: 'dbo', elementName: 'users', elementType: 'table' });
      const firstUid = store.getWorkspace('WS1')!.tabs[0].uid;

      store.newTab({ uid: 'WS1', type: 'data', schema: 'dbo', elementName: 'users', elementType: 'table' });
      const ws = store.getWorkspace('WS1')!;
      expect(ws.tabs).toHaveLength(1);
      expect(ws.tabs[0].uid).toBe(firstUid);
   });

   it('temp-data branch reuses the prior temp tab when there are no unsaved changes', () => {
      const store = useWorkspacesStore();
      seedWorkspace(store, { uid: 'WS1', database: 'master' });

      store.newTab({ uid: 'WS1', type: 'temp-data', schema: 'dbo', elementName: 'a', elementType: 'table' });
      const firstUid = store.getWorkspace('WS1')!.tabs[0].uid;

      store.newTab({ uid: 'WS1', type: 'temp-data', schema: 'dbo', elementName: 'b', elementType: 'table' });
      const tabs = store.getWorkspace('WS1')!.tabs;
      // Same single tab, now pointing at element 'b'
      expect(tabs).toHaveLength(1);
      expect(tabs[0].uid).toBe(firstUid);
      expect(tabs[0].elementName).toBe('b');
   });

   it('temp-data branch with unsaved changes: promotes the dirty temp tab to permanent and adds a fresh one', () => {
      const store = useWorkspacesStore();
      seedWorkspace(store, { uid: 'WS1', database: 'master' });

      store.newTab({ uid: 'WS1', type: 'temp-data', schema: 'dbo', elementName: 'a', elementType: 'table' });
      const dirtyUid = store.getWorkspace('WS1')!.tabs[0].uid;
      store.setUnsavedChanges({ uid: 'WS1', tUid: dirtyUid, isChanged: true });

      store.newTab({ uid: 'WS1', type: 'temp-data', schema: 'dbo', elementName: 'b', elementType: 'table' });

      const tabs = store.getWorkspace('WS1')!.tabs;
      expect(tabs).toHaveLength(2);
      // First (now permanent) — type stripped of 'temp-' prefix
      expect(tabs[0].uid).toBe(dirtyUid);
      expect(tabs[0].type).toBe('data');
      // Second (the fresh temp tab)
      expect(tabs[1].type).toBe('temp-data');
      expect(tabs[1].elementName).toBe('b');
   });
});

describe('workspaces store — removeTab / removeTabs', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('removeTab filters out the matching tab', () => {
      const store = useWorkspacesStore();
      seedWorkspace(store, {
         uid: 'WS1',
         tabs: [
            { uid: 'T1', type: 'query' } as WorkspaceTab,
            { uid: 'T2', type: 'query' } as WorkspaceTab
         ],
         selectedTab: 'T1'
      });

      store.removeTab({ uid: 'WS1', tab: 'T1' });
      const ws = store.getWorkspace('WS1')!;
      expect(ws.tabs.map(t => t.uid)).toEqual(['T2']);
   });

   it('removeTabs purges every tab matching {schema, elementName, elementType}', () => {
      const store = useWorkspacesStore();
      seedWorkspace(store, {
         uid: 'WS1',
         tabs: [
            { uid: 'T1', schema: 'dbo', elementName: 'users', elementType: 'table' } as WorkspaceTab,
            { uid: 'T2', schema: 'dbo', elementName: 'users', elementType: 'table' } as WorkspaceTab,
            { uid: 'T3', schema: 'dbo', elementName: 'orders', elementType: 'table' } as WorkspaceTab
         ],
         selectedTab: 'T1'
      });

      store.removeTabs({ uid: 'WS1', schema: 'dbo', elementName: 'users', elementType: 'table' });

      const ws = store.getWorkspace('WS1')!;
      expect(ws.tabs.map(t => t.uid)).toEqual(['T3']);
   });

   it('removeTabs maps elementType "procedure" → "routine" before filtering', () => {
      const store = useWorkspacesStore();
      seedWorkspace(store, {
         uid: 'WS1',
         tabs: [
            { uid: 'T1', schema: 'dbo', elementName: 'sp', elementType: 'routine' } as WorkspaceTab,
            { uid: 'T2', schema: 'dbo', elementName: 'sp', elementType: 'table' } as WorkspaceTab
         ],
         selectedTab: 'T1'
      });

      store.removeTabs({ uid: 'WS1', schema: 'dbo', elementName: 'sp', elementType: 'procedure' });

      const ws = store.getWorkspace('WS1')!;
      expect(ws.tabs.map(t => t.uid)).toEqual(['T2']);
   });
});

describe('workspaces store — setSearchTerm / setDatabase / changeBreadcrumbs / addLoadingElement', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('setSearchTerm writes onto the currently selected workspace only', () => {
      const store = useWorkspacesStore();
      seedWorkspace(store, { uid: 'WS1' });
      seedWorkspace(store, { uid: 'WS2' });
      store.selectWorkspace('WS1');

      store.setSearchTerm('foo');

      expect(store.getWorkspace('WS1')!.searchTerm).toBe('foo');
      expect(store.getWorkspace('WS2')!.searchTerm).toBe('');
   });

   it('setDatabase mutates the selected workspace', () => {
      const store = useWorkspacesStore();
      seedWorkspace(store, { uid: 'WS1' });
      store.selectWorkspace('WS1');

      store.setDatabase('mydb');

      expect(store.getWorkspace('WS1')!.database).toBe('mydb');
   });

   it('changeBreadcrumbs merges over a clean baseline of nulled fields', () => {
      const store = useWorkspacesStore();
      seedWorkspace(store, { uid: 'WS1' });
      store.selectWorkspace('WS1');

      store.changeBreadcrumbs({ schema: 'dbo', table: 'users' });

      expect(store.getWorkspace('WS1')!.breadcrumbs).toEqual({
         schema: 'dbo',
         table: 'users',
         trigger: null,
         triggerFunction: null,
         routine: null,
         function: null,
         scheduler: null,
         view: null,
         query: null
      });
   });

   it('addLoadedSchema accumulates schemas in the workspace Set', () => {
      const store = useWorkspacesStore();
      seedWorkspace(store, { uid: 'WS1' });
      store.selectWorkspace('WS1');

      store.addLoadedSchema('dbo');
      store.addLoadedSchema('etl');

      const set = store.getWorkspace('WS1')!.loadedSchemas;
      expect(Array.from(set)).toEqual(['dbo', 'etl']);
   });

   it('addLoadingElement appends to loadingElements on the selected workspace', () => {
      const store = useWorkspacesStore();
      seedWorkspace(store, { uid: 'WS1' });
      store.selectWorkspace('WS1');

      store.addLoadingElement({ name: 'users', schema: 'dbo', type: 'table' });

      expect(store.getWorkspace('WS1')!.loadingElements).toEqual([
         { name: 'users', schema: 'dbo', type: 'table' }
      ]);
   });
});

describe('workspaces store — renameTabs / setUnsavedChanges', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('renameTabs updates elementName on every matching tab', () => {
      const store = useWorkspacesStore();
      seedWorkspace(store, {
         uid: 'WS1',
         tabs: [
            { uid: 'T1', schema: 'dbo', elementName: 'old' } as WorkspaceTab,
            { uid: 'T2', schema: 'dbo', elementName: 'old' } as WorkspaceTab,
            { uid: 'T3', schema: 'dbo', elementName: 'unrelated' } as WorkspaceTab
         ]
      });

      store.renameTabs({ uid: 'WS1', schema: 'dbo', elementName: 'old', elementNewName: 'new' });

      const tabs = store.getWorkspace('WS1')!.tabs;
      expect(tabs.find(t => t.uid === 'T1')!.elementName).toBe('new');
      expect(tabs.find(t => t.uid === 'T2')!.elementName).toBe('new');
      expect(tabs.find(t => t.uid === 'T3')!.elementName).toBe('unrelated');
   });

   it('setUnsavedChanges flips isChanged on the matching tab only', () => {
      const store = useWorkspacesStore();
      seedWorkspace(store, {
         uid: 'WS1',
         tabs: [
            { uid: 'T1', isChanged: false } as WorkspaceTab,
            { uid: 'T2', isChanged: false } as WorkspaceTab
         ]
      });

      store.setUnsavedChanges({ uid: 'WS1', tUid: 'T1', isChanged: true });

      const tabs = store.getWorkspace('WS1')!.tabs;
      expect(tabs.find(t => t.uid === 'T1')!.isChanged).toBe(true);
      expect(tabs.find(t => t.uid === 'T2')!.isChanged).toBe(false);
   });
});

describe('workspaces store — removeConnected', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
      vi.clearAllMocks();
   });

   afterEach(() => {
      vi.restoreAllMocks();
   });

   it('calls Connection.disconnect and resets the workspace to disconnected', async () => {
      const store = useWorkspacesStore();
      seedWorkspace(store, { uid: 'WS1', status: 'connected' });

      vi.mocked(Connection.disconnect).mockResolvedValueOnce({} as never);

      store.removeConnected('WS1');

      expect(Connection.disconnect).toHaveBeenCalledWith('WS1');
      const ws = store.getWorkspace('WS1')!;
      expect(ws.connectionStatus).toBe('disconnected');
      expect(ws.structure).toEqual([]);
   });
});

describe('workspaces store — refreshStructure', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
      vi.clearAllMocks();
   });

   it('writes the response into workspace.structure on success', async () => {
      const store = useWorkspacesStore();
      store.addWorkspace('WS1');

      const responseShape = [{ name: 'dbo', size: 0, tables: [], functions: [], procedures: [], schedulers: [], triggers: [], triggerFunctions: [] }];
      vi.mocked(Schema.getStructure).mockResolvedValueOnce({
         status: 'success',
         response: responseShape
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      await store.refreshStructure('WS1');

      expect(store.getWorkspace('WS1')!.structure).toEqual(responseShape);
   });

   it('on error response: surfaces a notification and does not mutate structure', async () => {
      const pinia = createTestingPinia({
         stubActions: false,
         createSpy: vi.fn
      });
      setActivePinia(pinia);

      const store = useWorkspacesStore();
      store.addWorkspace('WS1');
      const notifications = useNotificationsStore();
      const addSpy = vi.spyOn(notifications, 'addNotification').mockImplementation(() => {});

      vi.mocked(Schema.getStructure).mockResolvedValueOnce({
         status: 'error',
         response: 'database broken'
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      await store.refreshStructure('WS1');

      expect(addSpy).toHaveBeenCalledWith({ status: 'error', message: 'database broken' });
      expect(store.getWorkspace('WS1')!.structure).toEqual([]);
   });
});

describe('workspaces store — connectWorkspace', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
      vi.clearAllMocks();
   });

   it('happy path: maps response → structure, status="connected", kicks off refresh* secondaries', async () => {
      const store = useWorkspacesStore();
      store.addWorkspace(connectFixture.request.payload.uid);

      vi.mocked(Connection.connect).mockResolvedValueOnce(connectFixture.response.body as never);
      vi.mocked(Schema.getVersion).mockResolvedValueOnce(versionFixture.response.body as never);
      // refreshCollations / refreshVariables / refreshEngines / refreshUsers
      // are dispatched but their results are unimportant for this assertion.
      vi.mocked(Schema.getCollations).mockResolvedValue({ status: 'success', response: [] } as never);
      vi.mocked(Schema.getVariables).mockResolvedValue({ status: 'success', response: [] } as never);
      vi.mocked(Schema.getEngines).mockResolvedValue({ status: 'success', response: [] } as never);
      vi.mocked(Users.getUsers).mockResolvedValue({ status: 'success', response: [] } as never);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await store.connectWorkspace(connectFixture.request.payload as any);

      const ws = store.getWorkspace(connectFixture.request.payload.uid)!;
      expect(ws.connectionStatus).toBe('connected');
      expect(ws.structure).toEqual(connectFixture.response.body.response);
      expect(ws.client).toBe('mssql');
      expect(Connection.connect).toHaveBeenCalledTimes(1);
      // Secondary fetches kicked off
      expect(Schema.getCollations).toHaveBeenCalledWith(connectFixture.request.payload.uid);
      expect(Schema.getVariables).toHaveBeenCalledWith(connectFixture.request.payload.uid);
      expect(Users.getUsers).toHaveBeenCalledWith(connectFixture.request.payload.uid);
   });

   it('error path: response.status==="error" → notification + status="failed", rejects with response message', async () => {
      const pinia = createTestingPinia({ stubActions: false, createSpy: vi.fn });
      setActivePinia(pinia);

      const store = useWorkspacesStore();
      store.addWorkspace('WS1');
      const notifications = useNotificationsStore();
      const addSpy = vi.spyOn(notifications, 'addNotification').mockImplementation(() => {});

      vi.mocked(Connection.connect).mockResolvedValueOnce({
         status: 'error',
         response: 'ECONNREFUSED'
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(store.connectWorkspace({ uid: 'WS1', client: 'mssql' } as any))
         .rejects.toThrow('ECONNREFUSED');

      expect(addSpy).toHaveBeenCalledWith({ status: 'error', message: 'ECONNREFUSED' });
      expect(store.getWorkspace('WS1')!.connectionStatus).toBe('failed');
   });

   it('aborted via AbortSignal: rejects with "Connection aborted by user"', async () => {
      const store = useWorkspacesStore();
      store.addWorkspace('WS1');

      // Make Connection.connect hang so the abort path wins.
      vi.mocked(Connection.connect).mockImplementationOnce(() => new Promise(() => { /* never resolves */ }));

      const controller = new AbortController();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const promise = store.connectWorkspace({ uid: 'WS1', client: 'mssql' } as any, { signal: controller.signal });
      // Yield once so the addEventListener is registered before we abort.
      await Promise.resolve();
      controller.abort();

      await expect(promise).rejects.toThrow('Connection aborted by user');
      expect(store.getWorkspace('WS1')!.connectionStatus).toBe('disconnected');
   });
});

describe('workspaces store — switchConnection', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
      vi.clearAllMocks();
   });

   it('pre-flips status to "connecting" before dispatching disconnect+reconnect', async () => {
      const store = useWorkspacesStore();
      store.addWorkspace('WS1');

      // Capture the status as observed at the moment Connection.disconnect runs.
      let observedStatus: string | undefined;
      vi.mocked(Connection.disconnect).mockImplementationOnce(async () => {
         observedStatus = store.getWorkspace('WS1')!.connectionStatus;
      });
      // Make connect hang so we don't have to set up a full success path.
      vi.mocked(Connection.connect).mockImplementationOnce(() => new Promise(() => {}));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store.switchConnection({ uid: 'WS1', client: 'mssql' } as any).catch(() => undefined);
      // Two ticks — first to schedule the status mutation, second so disconnect runs.
      await Promise.resolve();
      await Promise.resolve();

      expect(observedStatus).toBe('connecting');
   });

   it('proceeds with connect even when disconnect throws (sidecar unreachable)', async () => {
      const store = useWorkspacesStore();
      store.addWorkspace('WS1');

      vi.mocked(Connection.disconnect).mockRejectedValueOnce(new Error('ECONNREFUSED'));
      vi.mocked(Connection.connect).mockImplementationOnce(() => new Promise(() => {}));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      store.switchConnection({ uid: 'WS1', client: 'mssql' } as any).catch(() => undefined);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(Connection.connect).toHaveBeenCalledTimes(1);
   });
});
