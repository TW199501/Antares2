import { ClientCode, IpcResponse/*, EventInfos, QueryResult, RoutineInfos, TableInfos, TriggerInfos */ } from 'common/interfaces/antares';
import { ExportOptions } from 'common/interfaces/exporter';
import { ImportOptions } from 'common/interfaces/importer';

import { apiCall } from './httpClient';

export default class {
   static createSchema (params: { uid: string; name: string; collation?: string }): Promise<IpcResponse> {
      return apiCall('/api/schema/create', params);
   }

   static updateSchema (params: { uid: string; name: string; collation?: string }): Promise<IpcResponse> {
      return apiCall('/api/schema/update', params);
   }

   static getDatabaseCollation (params: { uid: string; database: string }): Promise<IpcResponse> {
      return apiCall('/api/schema/getCollation', params);
   }

   static deleteSchema (params: { uid: string; database: string }): Promise<IpcResponse> {
      return apiCall('/api/schema/delete', params);
   }

   static getStructure (params: { uid: string; schemas: Set<string> }): Promise<IpcResponse> {
      // Convert Set to Array for JSON serialization
      return apiCall('/api/schema/getStructure', { ...params, schemas: Array.from(params.schemas) });
   }

   static getCollations (uid: string): Promise<IpcResponse/* <{
      charset: string;
      collation: string;
      compiled: boolean;
      default: boolean;
      id: number;
      sortLen: number;
   }[]> */> {
      return apiCall('/api/schema/getCollations', { uid });
   }

   static getVariables (uid: string): Promise<IpcResponse/* <{ name: string; value: string }[]> */> {
      return apiCall('/api/schema/getVariables', { uid });
   }

   static getEngines (uid: string): Promise<IpcResponse/* <{
      name: string;
      support: string;
      comment: string;
      transactions: string;
      xa: string;
      savepoints: string;
      isDefault: boolean;
   }[]> */> {
      return apiCall('/api/schema/getEngines', { uid });
   }

   static getVersion (uid: string): Promise<IpcResponse/* <{
      number: string;
      name: string;
      arch: string;
      os: string;
   }> */> {
      return apiCall('/api/schema/getVersion', { uid });
   }

   static getProcesses (uid: string): Promise<IpcResponse/* <{
      id: number;
      user: string;
      host: string;
      db: string;
      command: string;
      time: number;
      state: string;
      info: string;
   }[]> */> {
      return apiCall('/api/schema/getProcesses', { uid });
   }

   static killProcess (params: { uid: string; pid: number }): Promise<IpcResponse> {
      return apiCall('/api/schema/killProcess', params);
   }

   static killTabQuery (params: { uid: string; tabUid: string }): Promise<IpcResponse> {
      return apiCall('/api/schema/killTabQuery', params);
   }

   static commitTab (params: { uid: string; tabUid: string }): Promise<IpcResponse> {
      return apiCall('/api/schema/commitTab', params);
   }

   static rollbackTab (params: { uid: string; tabUid: string }): Promise<IpcResponse> {
      return apiCall('/api/schema/rollbackTab', params);
   }

   static destroyConnectionToCommit (params: { uid: string; tabUid: string }): Promise<IpcResponse> {
      return apiCall('/api/schema/destroyConnectionToCommit', params);
   }

   static useSchema (params: { uid: string; schema: string }): Promise<IpcResponse> {
      return apiCall('/api/schema/useSchema', params);
   }

   static rawQuery (params: { uid: string; query: string; schema: string; tabUid: string; autocommit?: boolean }): Promise<IpcResponse/* <QueryResult> */> {
      return apiCall('/api/schema/rawQuery', params);
   }

   static export (params: ExportOptions & {uid: string; type: ClientCode}): Promise<IpcResponse> {
      return apiCall('/api/schema/export', params);
   }

   static abortExport (): Promise<IpcResponse> {
      return apiCall('/api/schema/abortExport');
   }

   static import (params: ImportOptions): Promise<IpcResponse> {
      return apiCall('/api/schema/importSql', params);
   }

   static abortImport (): Promise<IpcResponse> {
      return apiCall('/api/schema/abortImportSql');
   }
}
