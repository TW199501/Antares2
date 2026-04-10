import { ConnectionParams } from 'common/interfaces/antares';
import { uidGen } from 'common/libs/uidGen';
import { defineStore } from 'pinia';

import { i18n } from '@/i18n';
import { loadStore, saveStore } from '@/libs/persistStore';
import { useWorkspacesStore } from '@/stores/workspaces';

import { useNotificationsStore } from './notifications';

// TODO: Add encryption via sidecar endpoint
// NOTE: electron.safeStorage encryption has been removed for Tauri migration.
// Connections are currently stored in plaintext in localStorage / AppData file.

export interface SidebarElement {
   isFolder: boolean;
   uid: string;
   client?: string;
   connections?: string[];
   color?: string;
   name?: string;
   icon?: null | string;
   hasCustomIcon?: boolean;
}

export interface CustomIcon {base64: string; uid: string}

export const useConnectionsStore = defineStore('connections', {
   state: () => ({
      connections: [] as ConnectionParams[],
      lastConnections: [] as {uid: string; time: number}[],
      connectionsOrder: [] as SidebarElement[],
      customIcons: [] as CustomIcon[],
      _loaded: false
   }),
   getters: {
      getConnectionByUid: state => (uid:string) => state.connections.find(connection => connection.uid === uid),
      getConnectionName: state => (uid: string) => {
         const connection = state.connections.find(connection => connection.uid === uid);
         let connectionName = '';
         if (connection) {
            if (connection.name)
               connectionName = connection.name;
            else if (connection.ask)
               connectionName = `${connection.host}:${connection.port}`;
            else if (connection.databasePath) {
               let string = connection.databasePath.split(/[/\\]+/).pop();

               if (string.length >= 30)
                  string = `...${string.slice(-30)}`;

               connectionName = string;
            }
            else
               connectionName = `${connection.user + '@'}${connection.host}:${connection.port}`;
         }

         return connectionName;
      },
      getConnectionOrderByUid: state => (uid:string) => state.connectionsOrder
         .find(connection => connection.uid === uid),
      getFolders: state => state.connectionsOrder.filter(conn => conn.isFolder),
      getConnectionFolder: state => (uid:string) => state.connectionsOrder
         .find(folder => folder.isFolder && folder.connections.includes(uid)),
      getIconByUid: state => (uid:string) => state.customIcons.find(i => i.uid === uid)
   },
   actions: {
      async init () {
         const data = await loadStore('connections', {}) as Record<string, any>;
         if (data.connections !== undefined) this.connections = data.connections;
         if (data.lastConnections !== undefined) this.lastConnections = data.lastConnections;
         if (data.connectionsOrder !== undefined) this.connectionsOrder = data.connectionsOrder;
         if (data.custom_icons !== undefined) this.customIcons = data.custom_icons;
         this._loaded = true;
      },
      async persist () {
         await saveStore('connections', {
            connections: this.connections,
            lastConnections: this.lastConnections,
            connectionsOrder: this.connectionsOrder,
            custom_icons: this.customIcons
         });
      },
      addConnection (connection: ConnectionParams) {
         this.connections.push(connection);

         this.connectionsOrder.push({
            isFolder: false,
            uid: connection.uid,
            client: connection.client,
            icon: null,
            name: null
         });
         this.persist();
      },
      addFolder (params: {after?: string; connections: [string, string?]}) {
         const index = params.after
            ? this.connectionsOrder.findIndex((conn: SidebarElement) => conn.uid === params.after)
            : this.connectionsOrder.length;

         this.removeFromFolders(...params.connections);

         this.connectionsOrder.splice(index, 0, {
            isFolder: true,
            uid: uidGen('F'),
            name: '',
            color: '#E36929',
            connections: params.connections
         });
         this.persist();
      },
      removeFromFolders (...connections: string[]) { // Removes connections from folders
         this.connectionsOrder = (this.connectionsOrder as SidebarElement[]).map(el => {
            if (el.isFolder)
               el.connections = el.connections.filter(uid => !connections.includes(uid));
            return el;
         });

         this.clearEmptyFolders();
      },
      addToFolder (params: {folder: string; connection: string}) {
         this.removeFromFolders(params.connection);

         this.connectionsOrder = this.connectionsOrder.map((conn: SidebarElement) => {
            if (conn.uid === params.folder)
               conn.connections.push(params.connection);

            return conn;
         });
         this.persist();
         this.clearEmptyFolders();
      },
      deleteConnection (connection: SidebarElement | ConnectionParams) {
         this.removeFromFolders(connection.uid);
         this.connectionsOrder = (this.connectionsOrder as SidebarElement[]).filter(el => el.uid !== connection.uid);
         this.lastConnections = (this.lastConnections as SidebarElement[]).filter(el => el.uid !== connection.uid);

         this.connections = (this.connections as SidebarElement[]).filter(el => el.uid !== connection.uid);
         this.persist();
         this.clearEmptyFolders();
         useWorkspacesStore().removeWorkspace(connection.uid);
      },
      editConnection (connection: ConnectionParams) {
         const editedConnections = (this.connections as ConnectionParams[]).map(conn => {
            if (conn.uid === connection.uid) return connection;
            return conn;
         });

         this.connections = editedConnections;

         const editedConnectionsOrder = (this.connectionsOrder as SidebarElement[]).map(conn => {
            if (conn.uid === connection.uid) {
               return {
                  isFolder: false,
                  uid: connection.uid,
                  client: connection.client,
                  icon: conn.icon,
                  name: conn.name,
                  hasCustomIcon: conn.hasCustomIcon
               };
            }
            return conn;
         });

         this.connectionsOrder = editedConnectionsOrder;
         this.persist();
      },
      updateConnections (connections: ConnectionParams[]) {
         this.connections = connections;
         this.persist();
      },
      initConnectionsOrder () {
         this.connectionsOrder = (this.connections as ConnectionParams[]).map<SidebarElement>(conn => {
            return {
               isFolder: false,
               uid: conn.uid,
               client: conn.client,
               icon: null,
               name: null
            };
         });
         this.persist();
      },
      updateConnectionsOrder (connections: SidebarElement[]) {
         const invalidElements = connections.reduce<{index: number; uid: string}[]>((acc, curr, i) => {
            if (typeof curr === 'string')
               acc.push({ index: i, uid: curr });

            return acc;
         }, []);

         if (invalidElements.length) {
            invalidElements.forEach(el => {
               let connIndex = connections.findIndex(conn => conn.uid === el.uid);
               const conn = connections[connIndex];

               if (connIndex === -1) return;

               connections.splice(el.index, 1, { // Move to new position
                  isFolder: false,
                  client: conn.client,
                  uid: conn.uid,
                  icon: conn.icon,
                  name: conn.name,
                  hasCustomIcon: conn.hasCustomIcon
               });

               connIndex = connections.findIndex((conn, i) => conn.uid === el.uid && i !== el.index);
               connections.splice(connIndex, 1);// Delete old object
            });
         }

         // Clear empty folders
         const emptyFolders = connections.reduce<string[]>((acc, curr) => {
            if (curr.connections && curr.connections.length === 0)
               acc.push(curr.uid);
            return acc;
         }, []);

         connections = connections.filter(el => !emptyFolders.includes(el.uid));

         this.connectionsOrder = connections;
         this.persist();
      },
      updateConnectionOrder (element: SidebarElement) {
         this.connectionsOrder = (this.connectionsOrder as SidebarElement[]).map(el => {
            if (el.uid === element.uid)
               el = element;
            return el;
         });
         this.persist();
      },
      updateLastConnection (uid: string) {
         const cIndex = (this.lastConnections as {uid: string; time: number}[]).findIndex((c) => c.uid === uid);

         if (cIndex >= 0)
            this.lastConnections[cIndex].time = new Date().getTime();
         else
            this.lastConnections.push({ uid, time: new Date().getTime() });

         this.persist();
      },
      clearEmptyFolders () {
         // Clear empty folders
         const emptyFolders = (this.connectionsOrder as SidebarElement[]).reduce<string[]>((acc, curr) => {
            if (curr.connections && curr.connections.length === 0)
               acc.push(curr.uid);
            return acc;
         }, []);

         this.connectionsOrder = (this.connectionsOrder as SidebarElement[]).filter(el => !emptyFolders.includes(el.uid));
         this.persist();
      },
      // Custom Icons
      addIcon (svg: string) {
         if (svg.length > 16384) {
            const { t } = i18n.global;
            useNotificationsStore().addNotification({
               status: 'error',
               message: t('application.sizeLimitError', { size: '16KB' })
            });
            return;
         }

         const icon: CustomIcon = {
            uid: uidGen('I'),
            base64: svg
         };

         this.customIcons.push(icon);
         this.persist();
      },
      removeIcon (uid: string) {
         this.customIcons = this.customIcons.filter((i: CustomIcon) => i.uid !== uid);
         this.persist();
      },
      importConnections (importObj: {
         connections: ConnectionParams[];
         connectionsOrder: SidebarElement[];
         customIcons: CustomIcon[];
      }) {
         this.connections = [...this.connections, ...importObj.connections];
         this.connectionsOrder = [...this.connectionsOrder, ...importObj.connectionsOrder];
         this.customIcons = [...this.customIcons, ...importObj.customIcons];

         this.persist();
      }
   }
});
