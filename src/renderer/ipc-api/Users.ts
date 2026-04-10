import { IpcResponse } from 'common/interfaces/antares';

import { apiCall } from './httpClient';

export default class {
   static getUsers (params: string): Promise<IpcResponse> {
      return apiCall('/api/users/getUsers', params);
   }
}
