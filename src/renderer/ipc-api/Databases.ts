import { IpcResponse } from 'common/interfaces/antares';

import { apiCall } from './httpClient';

export default class {
   static getDatabases (uid: string): Promise<IpcResponse> {
      return apiCall('/api/databases/getDatabases', { uid });
   }
}
