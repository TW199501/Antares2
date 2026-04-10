import { AlterFunctionParams, CreateFunctionParams, IpcResponse } from 'common/interfaces/antares';

import { apiCall } from './httpClient';

export default class {
   static getFunctionInformations (params: { uid: string; schema: string; func: string}): Promise<IpcResponse> {
      return apiCall('/api/functions/getInformations', params);
   }

   static dropFunction (params: { uid: string; schema: string; func: string}): Promise<IpcResponse> {
      return apiCall('/api/functions/drop', params);
   }

   static alterFunction (params: { func: AlterFunctionParams }): Promise<IpcResponse> {
      return apiCall('/api/functions/alter', params);
   }

   static alterTriggerFunction (params: { uid: string; func: AlterFunctionParams }): Promise<IpcResponse> {
      return apiCall('/api/functions/alterTriggerFunction', params);
   }

   static createFunction (params: CreateFunctionParams & { uid: string }): Promise<IpcResponse> {
      return apiCall('/api/functions/create', params);
   }

   static createTriggerFunction (params: CreateFunctionParams & { uid: string }): Promise<IpcResponse> {
      return apiCall('/api/functions/createTriggerFunction', params);
   }
}
