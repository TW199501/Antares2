import { AlterEventParams, CreateEventParams, IpcResponse } from 'common/interfaces/antares';

import { apiCall } from './httpClient';

export default class {
   static getSchedulerInformations (params: { uid: string; schema: string; scheduler: string}): Promise<IpcResponse> {
      return apiCall('/api/schedulers/getInformations', params);
   }

   static dropScheduler (params: { uid: string; schema: string; scheduler: string}): Promise<IpcResponse> {
      return apiCall('/api/schedulers/drop', params);
   }

   static alterScheduler (params: { uid: string; scheduler: AlterEventParams }): Promise<IpcResponse> {
      return apiCall('/api/schedulers/alter', params);
   }

   static createScheduler (params: CreateEventParams & { uid: string }): Promise<IpcResponse> {
      return apiCall('/api/schedulers/create', params);
   }

   static toggleScheduler (params: { uid: string; schema: string; scheduler: string; enabled: boolean}): Promise<IpcResponse> {
      return apiCall('/api/schedulers/toggle', params);
   }
}
