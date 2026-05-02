import sqliteTypes from '../data-types/sqlite';
import { Customizations } from '../interfaces/customizations';
import { defaults } from './defaults';

export const customizations: Customizations = {
   ...defaults,
   dataTypes: sqliteTypes,
   indexTypes: [
      'PRIMARY',
      'INDEX',
      'UNIQUE'
   ],
   foreignActions: [
      'RESTRICT',
      'CASCADE',
      'SET NULL',
      'NO ACTION'
   ],
   // Core
   fileConnection: true,
   // Structure
   schemas: false,
   tables: true,
   views: true,
   triggers: true,
   // Settings
   elementsWrapper: '"',
   stringsWrapper: '\'',
   tableAdd: true,
   tableDuplicate: true,
   viewAdd: true,
   triggerAdd: true,
   schemaEdit: false,
   tableSettings: true,
   tableRealCount: true,
   viewSettings: true,
   triggerSettings: true,
   indexes: true,
   foreigns: true,
   // SQLite has no native column reorder via ALTER TABLE — reorder would
   // require drop + recreate + copy data, which is destructive on big tables
   // and breaks FK references. Hide the up/down buttons instead.
   sortableFields: false,
   nullable: true,
   nullablePrimary: true,
   triggerSql: 'BEGIN\r\n\r\nEND',
   readOnlyMode: true
};
