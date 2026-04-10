import { AlterTableParams, CreateTableParams, IpcResponse } from 'common/interfaces/antares';

import { apiCall } from './httpClient';

export default class {
   static getTableColumns (params: {schema: string; table: string }): Promise<IpcResponse> {
      return apiCall('/api/tables/getColumns', params);
   }

   static getTableData (params: {
      uid: string;
      schema: string;
      table: string;
      limit: number;
      page: number;
      sortParams: {
         field: string;
         dir: 'asc' | 'desc' ;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: any;
   }): Promise<IpcResponse> {
      return apiCall('/api/tables/getData', params);
   }

   static getTableApproximateCount (params: { uid: string; schema: string; table: string }): Promise<IpcResponse<number>> {
      return apiCall('/api/tables/getCount', params);
   }

   static getTableOptions (params: { uid: string; schema: string; table: string }): Promise<IpcResponse> {
      return apiCall('/api/tables/getOptions', params);
   }

   static getTableIndexes (params: { uid: string; schema: string; table: string }): Promise<IpcResponse> {
      return apiCall('/api/tables/getIndexes', params);
   }

   static getTableChecks (params: { uid: string; schema: string; table: string }): Promise<IpcResponse> {
      return apiCall('/api/tables/getChecks', params);
   }

   static getTableDll (params: { uid: string; schema: string; table: string }): Promise<IpcResponse<string>> {
      return apiCall('/api/tables/getDdl', params);
   }

   static getKeyUsage (params: { uid: string; schema: string; table: string }): Promise<IpcResponse> {
      return apiCall('/api/tables/getKeyUsage', params);
   }

   static updateTableCell (params: {
      uid: string;
      schema: string;
      table: string;
      primary?: string;
      id: number | string;
      content: number | string | boolean | Date | Blob | null;
      type: string;
      field: string;
   }): Promise<IpcResponse> {
      return apiCall('/api/tables/updateCell', params);
   }

   static deleteTableRows (params: {
      uid: string;
      schema: string;
      table: string;
      primary?: string;
      field: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rows: Record<string, any>;
   }): Promise<IpcResponse> {
      return apiCall('/api/tables/deleteRows', params);
   }

   static insertTableFakeRows (params: {
      uid: string;
      schema: string;
      table: string;
      row: Record<string, string | number | boolean | Date | Buffer>;
      repeat: number;
      fields: Record<string, string>;
      locale: string;
   }): Promise<IpcResponse> {
      return apiCall('/api/tables/insertFakeRows', params);
   }

   static getForeignList (params: {
      uid: string;
      schema: string;
      table: string;
      column: string;
      description: string | false;
   }): Promise<IpcResponse> {
      return apiCall('/api/tables/getForeignList', params);
   }

   static createTable (params: CreateTableParams): Promise<IpcResponse> {
      return apiCall('/api/tables/create', params);
   }

   static alterTable (params: AlterTableParams): Promise<IpcResponse> {
      return apiCall('/api/tables/alter', params);
   }

   static duplicateTable (params: { uid: string; schema: string; table: string }): Promise<IpcResponse> {
      return apiCall('/api/tables/duplicate', params);
   }

   static truncateTable (params: { uid: string; schema: string; table: string; force: boolean }): Promise<IpcResponse> {
      return apiCall('/api/tables/truncate', params);
   }

   static dropTable (params: { uid: string; schema: string; table: string }): Promise<IpcResponse> {
      return apiCall('/api/tables/drop', params);
   }
}
