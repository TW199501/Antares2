/**
 * SQL Builder dispatcher — routes builder calls to the right per-client
 * implementation. MVP only supports `mssql`; other clients throw
 * `NotImplementedError` at call time so callers can degrade gracefully.
 */
import { ClientCode } from 'common/interfaces/antares';

import {
   BuildSingleTableInput,
   buildSingleTableSql as buildMssqlSingleTable } from './mssql';

export type {
   BuildSingleTableInput,
   SqlCondition,
   SqlOperator,
   SqlOrderBy,
   SqlValueKind
} from './mssql';

export class NotImplementedError extends Error {
   constructor (client: ClientCode, mode: string) {
      super(`SQL builder mode '${mode}' is not yet implemented for client '${client}'.`);
      this.name = 'NotImplementedError';
   }
}

export const buildSingleTableSql = (
   client: ClientCode,
   input: BuildSingleTableInput
): string => {
   if (client === 'mssql')
      return buildMssqlSingleTable(input);

   throw new NotImplementedError(client, 'single-table');
};
