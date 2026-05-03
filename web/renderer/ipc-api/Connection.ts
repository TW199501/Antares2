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

   static async checkConnection (uid: string): Promise<boolean> {
      const result = await apiCall<{ status: string; response: boolean }>('/api/connection/check', { uid });
      return result.response === true;
   }

   static disconnect (uid: string): Promise<void> {
      return apiCall('/api/connection/disconnect', { uid });
   }
}
