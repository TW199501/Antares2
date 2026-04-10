import * as firebird from 'common/customizations/firebird';
import * as mssql from 'common/customizations/sqlserver';
import * as mysql from 'common/customizations/mysql';
import * as postgresql from 'common/customizations/postgresql';
import * as sqlite from 'common/customizations/sqlite';
import { Customizations } from 'common/interfaces/customizations';

export default {
   maria: mysql.customizations,
   mysql: mysql.customizations,
   pg: postgresql.customizations,
   mssql: mssql.customizations,
   sqlite: sqlite.customizations,
   firebird: firebird.customizations
} as {
   maria: Customizations;
   mysql: Customizations;
   pg: Customizations;
   mssql: Customizations;
   sqlite: Customizations;
   firebird: Customizations;
};
