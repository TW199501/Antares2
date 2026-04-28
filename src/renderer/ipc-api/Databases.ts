import { IpcResponse } from 'common/interfaces/antares';

import { apiCall } from './httpClient';

export default class {
   static getDatabases (uid: string): Promise<IpcResponse> {
      return apiCall('/api/databases/getDatabases', { uid });
   }

   static getDatabaseComment (uid: string): Promise<IpcResponse<string>> {
      return apiCall('/api/databases/getDatabaseComment', { uid });
   }
}
