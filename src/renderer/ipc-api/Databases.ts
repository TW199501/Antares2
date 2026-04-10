import { IpcResponse } from 'common/interfaces/antares';

import { apiCall } from './httpClient';

export default class {
   static getDatabases (params: string): Promise<IpcResponse> {
      return apiCall('/api/databases/getDatabases', params);
   }
}
