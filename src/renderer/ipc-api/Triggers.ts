import { AlterTriggerParams, CreateTriggerParams, IpcResponse } from 'common/interfaces/antares';

import { apiCall } from './httpClient';

export default class {
   static getTriggerInformations (params: { uid: string; schema: string; trigger: string }): Promise<IpcResponse> {
      return apiCall('/api/triggers/getInformations', params);
   }

   static dropTrigger (params: { uid: string; schema: string; trigger: string }): Promise<IpcResponse> {
      return apiCall('/api/triggers/drop', params);
   }

   static alterTrigger (params: { trigger: AlterTriggerParams & { uid: string }}): Promise<IpcResponse> {
      return apiCall('/api/triggers/alter', params);
   }

   static createTrigger (params: CreateTriggerParams & { uid: string }): Promise<IpcResponse> {
      return apiCall('/api/triggers/create', params);
   }

   static toggleTrigger (params: { uid: string; schema: string; trigger: string; enabled: boolean }): Promise<IpcResponse> {
      return apiCall('/api/triggers/toggle', params);
   }
}
