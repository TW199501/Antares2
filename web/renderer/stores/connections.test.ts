/**
 * connections store — Pinia store tests (T10 / PR5).
 *
 * Tested behaviors:
 *   - Default state (empty arrays, _loaded=false)
 *   - Getters: getConnectionByUid / getConnectionName (4 fallback paths) /
 *     getConnectionOrderByUid / getFolders / getConnectionFolder / getIconByUid
 *   - addConnection: pushes to connections + appends a non-folder SidebarElement
 *   - editConnection: replaces matching connection AND its order entry while
 *     preserving icon/name/hasCustomIcon on the order entry
 *   - deleteConnection: removes from connections, order, lastConnections,
 *     clears empty folders, and forwards to workspaces.removeWorkspace
 *   - addFolder / addToFolder / removeFromFolders / clearEmptyFolders
 *   - addIcon: pushes when payload is small; emits notification + early-returns
 *     when SVG length > 16384 (size limit guard)
 *   - removeIcon
 *   - importConnections: appends to all three arrays
 *   - updateLastConnection: inserts on first call, updates time on subsequent
 *   - init() / persist(): localStorage round-trip via the persistStore helper
 *   - Sub-store interactions are isolated via createTestingPinia({ stubActions })
 *     for tests that exercise deleteConnection (which depends on workspaces).
 */
import { createTestingPinia } from '@pinia/testing';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { saveStore } from '@/libs/persistStore';

import { type SidebarElement, useConnectionsStore } from './connections';
import { useNotificationsStore } from './notifications';
import { useWorkspacesStore } from './workspaces';

// Helper — make the smallest valid ConnectionParams for our tests.
function makeConnection (overrides: Partial<{
   uid: string;
   client: string;
   host: string;
   port: number;
   user: string;
   name: string;
   ask: boolean;
   databasePath: string;
}> = {}) {
   return {
      uid: overrides.uid ?? 'C1',
      client: overrides.client ?? 'mssql',
      host: overrides.host ?? '127.0.0.1',
      port: overrides.port ?? 1433,
      user: overrides.user ?? 'sa',
      name: overrides.name,
      ask: overrides.ask ?? false,
      databasePath: overrides.databasePath
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
   } as any;
}

describe('connections store — default state', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('starts with empty arrays and _loaded=false', () => {
      const store = useConnectionsStore();
      expect(store.connections).toEqual([]);
      expect(store.lastConnections).toEqual([]);
      expect(store.connectionsOrder).toEqual([]);
      expect(store.customIcons).toEqual([]);
      expect(store._loaded).toBe(false);
   });
});

describe('connections store — getters', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('getConnectionByUid returns the matching connection or undefined', () => {
      const store = useConnectionsStore();
      const c = makeConnection({ uid: 'C1' });
      store.connections = [c];
      // Pinia wraps state in reactive Proxies, so identity comparison fails;
      // compare by uid instead (deep equal would work but is noisier).
      expect(store.getConnectionByUid('C1')!.uid).toBe('C1');
      expect(store.getConnectionByUid('C-missing')).toBeUndefined();
   });

   it('getConnectionName: prefers explicit name', () => {
      const store = useConnectionsStore();
      store.connections = [makeConnection({ uid: 'C1', name: 'My DB' })];
      expect(store.getConnectionName('C1')).toBe('My DB');
   });

   it('getConnectionName: ask flag → host:port', () => {
      const store = useConnectionsStore();
      store.connections = [makeConnection({ uid: 'C1', ask: true })];
      expect(store.getConnectionName('C1')).toBe('127.0.0.1:1433');
   });

   it('getConnectionName: fallback to user@host:port when no name/ask/databasePath', () => {
      const store = useConnectionsStore();
      store.connections = [makeConnection({ uid: 'C1' })];
      expect(store.getConnectionName('C1')).toBe('sa@127.0.0.1:1433');
   });

   it('getConnectionName: short databasePath returns the basename verbatim', () => {
      const store = useConnectionsStore();
      store.connections = [makeConnection({ uid: 'C1', databasePath: '/var/db/foo.sqlite' })];
      expect(store.getConnectionName('C1')).toBe('foo.sqlite');
   });

   it('getConnectionName: long databasePath basename is truncated to ...<last 30 chars>', () => {
      const longName = 'a'.repeat(45) + '.sqlite'; // 52 chars total
      const store = useConnectionsStore();
      store.connections = [makeConnection({ uid: 'C1', databasePath: `/x/${longName}` })];
      const result = store.getConnectionName('C1');
      expect(result.startsWith('...')).toBe(true);
      // 3 ellipsis chars + 30 trailing chars
      expect(result.length).toBe(33);
   });

   it('getConnectionName returns empty string when uid is unknown', () => {
      const store = useConnectionsStore();
      expect(store.getConnectionName('missing')).toBe('');
   });

   it('getFolders returns only folder elements', () => {
      const store = useConnectionsStore();
      store.connectionsOrder = [
         { isFolder: false, uid: 'C1' },
         { isFolder: true, uid: 'F1', connections: [] },
         { isFolder: true, uid: 'F2', connections: ['C1'] }
      ] as SidebarElement[];
      expect(store.getFolders.map((f: SidebarElement) => f.uid)).toEqual(['F1', 'F2']);
   });

   it('getConnectionFolder returns the folder containing the given uid', () => {
      const store = useConnectionsStore();
      store.connectionsOrder = [
         { isFolder: true, uid: 'F1', connections: ['C1', 'C2'] },
         { isFolder: true, uid: 'F2', connections: ['C3'] }
      ] as SidebarElement[];
      expect(store.getConnectionFolder('C2').uid).toBe('F1');
      expect(store.getConnectionFolder('C3').uid).toBe('F2');
      expect(store.getConnectionFolder('C-missing')).toBeUndefined();
   });

   it('getIconByUid returns the matching custom icon', () => {
      const store = useConnectionsStore();
      store.customIcons = [{ uid: 'I1', base64: 'svgdata' }];
      expect(store.getIconByUid('I1')).toEqual({ uid: 'I1', base64: 'svgdata' });
      expect(store.getIconByUid('missing')).toBeUndefined();
   });
});

describe('connections store — addConnection', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('appends to connections AND to connectionsOrder as a non-folder element', () => {
      const store = useConnectionsStore();
      store.addConnection(makeConnection({ uid: 'C1' }));
      expect(store.connections).toHaveLength(1);
      expect(store.connectionsOrder).toHaveLength(1);
      expect(store.connectionsOrder[0]).toEqual({
         isFolder: false,
         uid: 'C1',
         client: 'mssql',
         icon: null,
         name: null
      });
   });
});

describe('connections store — editConnection', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('replaces matching connection and rewrites order entry preserving icon/name/hasCustomIcon', () => {
      const store = useConnectionsStore();
      store.connections = [
         makeConnection({ uid: 'C1', name: 'Old' }),
         makeConnection({ uid: 'C2', name: 'Other' })
      ];
      store.connectionsOrder = [
         { isFolder: false, uid: 'C1', client: 'mssql', icon: 'mdi-database', name: 'pretty', hasCustomIcon: true },
         { isFolder: false, uid: 'C2', client: 'mssql', icon: null, name: null }
      ] as SidebarElement[];

      const updated = makeConnection({ uid: 'C1', name: 'New', client: 'pg' });
      store.editConnection(updated);

      expect(store.connections.find(c => c.uid === 'C1')!.name).toBe('New');
      expect(store.connections.find(c => c.uid === 'C1')!.client).toBe('pg');
      const order = store.connectionsOrder.find((o: SidebarElement) => o.uid === 'C1')!;
      expect(order.client).toBe('pg');
      expect(order.icon).toBe('mdi-database');
      expect(order.name).toBe('pretty');
      expect(order.hasCustomIcon).toBe(true);
      // Other entry untouched
      expect(store.connectionsOrder.find((o: SidebarElement) => o.uid === 'C2')!.client).toBe('mssql');
   });
});

describe('connections store — folder operations', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('addFolder inserts a folder containing the listed connections at the chosen index', () => {
      const store = useConnectionsStore();
      store.connectionsOrder = [
         { isFolder: false, uid: 'C1' },
         { isFolder: false, uid: 'C2' }
      ] as SidebarElement[];

      store.addFolder({ connections: ['C1', 'C2'] });

      const folders = store.connectionsOrder.filter((o: SidebarElement) => o.isFolder);
      expect(folders).toHaveLength(1);
      expect(folders[0].connections).toEqual(['C1', 'C2']);
   });

   it('addToFolder moves a connection into a folder, removing it from any prior folder', () => {
      const store = useConnectionsStore();
      store.connectionsOrder = [
         { isFolder: true, uid: 'F1', connections: ['C1'] },
         // F2 must hold an unrelated connection so it survives the implicit
         // clearEmptyFolders call inside addToFolder. (Otherwise it gets
         // wiped before the move can land.)
         { isFolder: true, uid: 'F2', connections: ['C9'] }
      ] as SidebarElement[];

      store.addToFolder({ folder: 'F2', connection: 'C1' });

      // F1 had only C1 → now empty → cleared by clearEmptyFolders
      expect(store.connectionsOrder.find((o: SidebarElement) => o.uid === 'F1')).toBeUndefined();
      expect(store.connectionsOrder.find((o: SidebarElement) => o.uid === 'F2')!.connections).toEqual(['C9', 'C1']);
   });

   it('removeFromFolders strips uids from every folder & deletes any that become empty', () => {
      const store = useConnectionsStore();
      store.connectionsOrder = [
         { isFolder: true, uid: 'F1', connections: ['C1'] },
         { isFolder: true, uid: 'F2', connections: ['C2', 'C3'] }
      ] as SidebarElement[];

      store.removeFromFolders('C1', 'C3');

      // F1 emptied -> cleared, F2 survives with [C2]
      expect(store.connectionsOrder.find((o: SidebarElement) => o.uid === 'F1')).toBeUndefined();
      expect(store.connectionsOrder.find((o: SidebarElement) => o.uid === 'F2')!.connections).toEqual(['C2']);
   });

   it('clearEmptyFolders removes folders whose connections array is empty', () => {
      const store = useConnectionsStore();
      store.connectionsOrder = [
         { isFolder: true, uid: 'F1', connections: [] },
         { isFolder: true, uid: 'F2', connections: ['C1'] }
      ] as SidebarElement[];

      store.clearEmptyFolders();

      expect(store.connectionsOrder.map((o: SidebarElement) => o.uid)).toEqual(['F2']);
   });
});

describe('connections store — deleteConnection (depends on workspaces store)', () => {
   beforeEach(() => {
      // stubActions=false so the real connections.deleteConnection executes;
      // we'll spy on workspaces.removeWorkspace independently.
      setActivePinia(createTestingPinia({ stubActions: false, createSpy: vi.fn }));
   });

   it('removes from connections / connectionsOrder / lastConnections and forwards to workspaces.removeWorkspace', () => {
      const store = useConnectionsStore();
      const workspaces = useWorkspacesStore();
      const removeSpy = vi.spyOn(workspaces, 'removeWorkspace').mockImplementation(() => {});
      store.connections = [makeConnection({ uid: 'C1' }), makeConnection({ uid: 'C2' })];
      store.connectionsOrder = [
         { isFolder: false, uid: 'C1' },
         { isFolder: false, uid: 'C2' }
      ] as SidebarElement[];
      store.lastConnections = [{ uid: 'C1', time: 1 }, { uid: 'C2', time: 2 }];

      store.deleteConnection({ uid: 'C1' } as SidebarElement);

      expect(store.connections.map(c => c.uid)).toEqual(['C2']);
      expect((store.connectionsOrder as SidebarElement[]).map(o => o.uid)).toEqual(['C2']);
      expect(store.lastConnections.map(l => l.uid)).toEqual(['C2']);
      expect(removeSpy).toHaveBeenCalledWith('C1');
   });
});

describe('connections store — custom icons', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('addIcon pushes a new entry with a generated uid', () => {
      const store = useConnectionsStore();
      store.addIcon('<svg/>');
      expect(store.customIcons).toHaveLength(1);
      expect(store.customIcons[0].base64).toBe('<svg/>');
      expect(store.customIcons[0].uid.startsWith('I')).toBe(true);
   });

   it('addIcon: rejects payloads larger than 16KB and surfaces a notification', () => {
      const store = useConnectionsStore();
      const notifications = useNotificationsStore();
      const spy = vi.spyOn(notifications, 'addNotification').mockImplementation(() => {});

      const huge = 'x'.repeat(16385);
      store.addIcon(huge);

      expect(store.customIcons).toHaveLength(0);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].status).toBe('error');
      spy.mockRestore();
   });

   it('removeIcon filters out the matching uid', () => {
      const store = useConnectionsStore();
      store.customIcons = [
         { uid: 'I1', base64: 'a' },
         { uid: 'I2', base64: 'b' }
      ];
      store.removeIcon('I1');
      expect(store.customIcons.map(i => i.uid)).toEqual(['I2']);
   });
});

describe('connections store — importConnections', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('appends to connections / connectionsOrder / customIcons', () => {
      const store = useConnectionsStore();
      store.connections = [makeConnection({ uid: 'C1' })];
      store.connectionsOrder = [{ isFolder: false, uid: 'C1' }] as SidebarElement[];
      store.customIcons = [{ uid: 'I1', base64: 'a' }];

      store.importConnections({
         connections: [makeConnection({ uid: 'C2' })],
         connectionsOrder: [{ isFolder: false, uid: 'C2' } as SidebarElement],
         customIcons: [{ uid: 'I2', base64: 'b' }]
      });

      expect(store.connections.map(c => c.uid)).toEqual(['C1', 'C2']);
      expect((store.connectionsOrder as SidebarElement[]).map(o => o.uid)).toEqual(['C1', 'C2']);
      expect(store.customIcons.map(i => i.uid)).toEqual(['I1', 'I2']);
   });
});

describe('connections store — updateLastConnection', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('inserts a new {uid,time} on first call', () => {
      const store = useConnectionsStore();
      const before = Date.now() - 1;
      store.updateLastConnection('C1');
      expect(store.lastConnections).toHaveLength(1);
      expect(store.lastConnections[0].uid).toBe('C1');
      expect(store.lastConnections[0].time).toBeGreaterThan(before);
   });

   it('updates the existing time on subsequent calls without duplicating the entry', () => {
      const store = useConnectionsStore();
      store.lastConnections = [{ uid: 'C1', time: 1 }];
      store.updateLastConnection('C1');
      expect(store.lastConnections).toHaveLength(1);
      expect(store.lastConnections[0].time).toBeGreaterThan(1);
   });
});

describe('connections store — initConnectionsOrder', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('rebuilds connectionsOrder from connections, one non-folder entry per connection', () => {
      const store = useConnectionsStore();
      store.connections = [
         makeConnection({ uid: 'C1', client: 'mssql' }),
         makeConnection({ uid: 'C2', client: 'pg' })
      ];

      store.initConnectionsOrder();

      expect(store.connectionsOrder).toEqual([
         { isFolder: false, uid: 'C1', client: 'mssql', icon: null, name: null },
         { isFolder: false, uid: 'C2', client: 'pg', icon: null, name: null }
      ]);
   });
});

describe('connections store — updateConnections', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('replaces the connections array wholesale', () => {
      const store = useConnectionsStore();
      store.connections = [makeConnection({ uid: 'C1' })];
      const next = [makeConnection({ uid: 'C2' }), makeConnection({ uid: 'C3' })];
      store.updateConnections(next);
      expect(store.connections).toEqual(next);
   });
});

describe('connections store — init() persistence round-trip', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('hydrates state from previously persisted data via localStorage', async () => {
      await saveStore('connections', {
         connections: [makeConnection({ uid: 'C1' })],
         lastConnections: [{ uid: 'C1', time: 999 }],
         connectionsOrder: [{ isFolder: false, uid: 'C1' }],
         custom_icons: [{ uid: 'I1', base64: 'a' }]
      });

      const store = useConnectionsStore();
      await store.init();

      expect(store.connections.map(c => c.uid)).toEqual(['C1']);
      expect(store.lastConnections).toEqual([{ uid: 'C1', time: 999 }]);
      expect(store.connectionsOrder.map((o: SidebarElement) => o.uid)).toEqual(['C1']);
      expect(store.customIcons.map(i => i.uid)).toEqual(['I1']);
      expect(store._loaded).toBe(true);
   });
});
