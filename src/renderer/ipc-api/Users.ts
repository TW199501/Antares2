import { IpcResponse } from 'common/interfaces/antares';

import { apiCall } from './httpClient';

export default class {
   static getUsers (uid: string): Promise<IpcResponse> {
      return apiCall('/api/users/getUsers', { uid });
   }
}
