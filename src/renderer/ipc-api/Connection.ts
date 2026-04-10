import { ConnectionParams, IpcResponse } from 'common/interfaces/antares';

import { apiCall } from './httpClient';

export default class {
   static makeTest (params: ConnectionParams & { connString?: string }): Promise<IpcResponse> {
      return apiCall('/api/connection/test', params);
   }

   static connect (params: ConnectionParams & { connString?: string }): Promise<IpcResponse> {
      return apiCall('/api/connection/connect', params);
   }

   static abortConnection (uid: string): void {
      apiCall('/api/connection/abort', { uid });
   }

   static checkConnection (uid: string): Promise<boolean> {
      return apiCall('/api/connection/check', { uid });
   }

   static disconnect (uid: string): Promise<void> {
      return apiCall('/api/connection/disconnect', { uid });
   }
}
