import { TypesGroup } from 'common/interfaces/antares';

export default [
   {
      group: 'integer',
      types: [
         { name: 'BIT', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'TINYINT', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'SMALLINT', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'INT', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'BIGINT', length: false, collation: false, unsigned: false, zerofill: false }
      ]
   },
   {
      group: 'float',
      types: [
         { name: 'DECIMAL', length: true, collation: false, unsigned: false, zerofill: false },
         { name: 'NUMERIC', length: true, collation: false, unsigned: false, zerofill: false },
         { name: 'FLOAT', length: true, collation: false, unsigned: false, zerofill: false },
         { name: 'REAL', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'MONEY', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'SMALLMONEY', length: false, collation: false, unsigned: false, zerofill: false }
      ]
   },
   {
      group: 'string',
      types: [
         { name: 'CHAR', length: true, collation: true, unsigned: false, zerofill: false },
         { name: 'VARCHAR', length: true, collation: true, unsigned: false, zerofill: false },
         { name: 'TEXT', length: false, collation: true, unsigned: false, zerofill: false },
         { name: 'NCHAR', length: true, collation: true, unsigned: false, zerofill: false },
         { name: 'NVARCHAR', length: true, collation: true, unsigned: false, zerofill: false },
         { name: 'NTEXT', length: false, collation: true, unsigned: false, zerofill: false }
      ]
   },
   {
      group: 'binary',
      types: [
         { name: 'BINARY', length: true, collation: false, unsigned: false, zerofill: false },
         { name: 'VARBINARY', length: true, collation: false, unsigned: false, zerofill: false },
         { name: 'IMAGE', length: false, collation: false, unsigned: false, zerofill: false }
      ]
   },
   {
      group: 'time',
      types: [
         { name: 'DATE', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'TIME', length: true, collation: false, unsigned: false, zerofill: false },
         { name: 'DATETIME', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'DATETIME2', length: true, scale: true, collation: false, unsigned: false, zerofill: false },
         { name: 'DATETIMEOFFSET', length: true, scale: true, collation: false, unsigned: false, zerofill: false },
         { name: 'SMALLDATETIME', length: false, collation: false, unsigned: false, zerofill: false }
      ]
   },
   {
      group: 'other',
      types: [
         { name: 'UNIQUEIDENTIFIER', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'XML', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'SQL_VARIANT', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'HIERARCHYID', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'GEOGRAPHY', length: false, collation: false, unsigned: false, zerofill: false },
         { name: 'GEOMETRY', length: false, collation: false, unsigned: false, zerofill: false }
      ]
   }
] as TypesGroup[];
