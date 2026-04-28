import { IpcResponse } from 'common/interfaces/antares';

import { apiCall } from './httpClient';

export default class {
   static translateColumn (params: {
      columnName: string;
      tableName?: string;
      apiKey: string;
   }): Promise<IpcResponse> {
      return apiCall('/api/ai/translate-column', params);
   }
}
