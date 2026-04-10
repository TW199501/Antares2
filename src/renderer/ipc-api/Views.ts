import { AlterViewParams, CreateViewParams, IpcResponse } from 'common/interfaces/antares';

import { apiCall } from './httpClient';

export default class {
   static getViewInformations (params: { uid: string; schema: string; view: string }): Promise<IpcResponse> {
      return apiCall('/api/views/getInformations', params);
   }

   static dropView (params: { uid: string; schema: string; view: string }): Promise<IpcResponse> {
      return apiCall('/api/views/drop', params);
   }

   static alterView (params: { view: AlterViewParams & { uid: string }}): Promise<IpcResponse> {
      return apiCall('/api/views/alter', params);
   }

   static createView (params: CreateViewParams & { uid: string }): Promise<IpcResponse> {
      return apiCall('/api/views/create', params);
   }

   static createMaterializedView (params: CreateViewParams & { uid: string }): Promise<IpcResponse> {
      return apiCall('/api/views/createMaterialized', params);
   }

   static getMaterializedViewInformations (params: { uid: string; schema: string; view: string }): Promise<IpcResponse> {
      return apiCall('/api/views/getMaterializedInformations', params);
   }

   static dropMaterializedView (params: { uid: string; schema: string; view: string }): Promise<IpcResponse> {
      return apiCall('/api/views/dropMaterialized', params);
   }

   static alterMaterializedView (params: { view: AlterViewParams & { uid: string }}): Promise<IpcResponse> {
      return apiCall('/api/views/alterMaterialized', params);
   }
}
