import { IpcResponse } from 'common/interfaces/antares';

import { apiCall } from './httpClient';

export default class {
   /**
    * Translate a column name into a short description in the user's UI locale.
    *
    * Backend route uses the public Google Translate endpoint
    * (translate.googleapis.com/translate_a/single?client=gtx) — no API key
    * required, no `aiApiKey` setting needed. Best-effort: Google may rate-
    * limit by IP under heavy use.
    */
   static translateColumn (params: {
      columnName: string;
      targetLocale: string;
   }): Promise<IpcResponse> {
      return apiCall('/api/ai/translate-column', params);
   }
}
