import { AlterRoutineParams, CreateRoutineParams, IpcResponse } from 'common/interfaces/antares';

import { apiCall } from './httpClient';

export default class {
   static getRoutineInformations (params: { uid: string; schema: string; routine: string}): Promise<IpcResponse> {
      return apiCall('/api/routines/getInformations', params);
   }

   static dropRoutine (params: { uid: string; schema: string; routine: string}): Promise<IpcResponse> {
      return apiCall('/api/routines/drop', params);
   }

   static alterRoutine (params: { uid: string; routine: AlterRoutineParams }): Promise<IpcResponse> {
      return apiCall('/api/routines/alter', params);
   }

   static createRoutine (params: { routine: CreateRoutineParams & { uid: string } }): Promise<IpcResponse> {
      return apiCall('/api/routines/create', params);
   }
}
