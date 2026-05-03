/**
 * Characterization tests for fieldTypes.ts — DB type → category buckets.
 *
 * Each export is a string[] grouping SQL type names by family (TEXT, NUMBER,
 * FLOAT, DATE, etc.). Two arrays (HAS_TIMEZONE, IS_MULTI_SPATIAL, IS_BIGINT)
 * are intentional sub-sets of larger arrays — we lock in those subset
 * relations. All entries are uppercase. Tests assert membership of canonical
 * names plus stable shape (uniqueness, non-empty), not full snapshot equality
 * (so adding a new type to NUMBER won't fail unrelated tests).
 */
import { describe, expect, it } from 'vitest';

import {
   ARRAY,
   BINARY,
   BIT,
   BLOB,
   BOOLEAN,
   DATE,
   DATETIME,
   FLOAT,
   HAS_TIMEZONE,
   IS_BIGINT,
   IS_MULTI_SPATIAL,
   LONG_TEXT,
   NUMBER,
   SPATIAL,
   TEXT,
   TEXT_SEARCH,
   TIME,
   UUID
} from './fieldTypes';

const allArrays = {
   TEXT,
   LONG_TEXT,
   ARRAY,
   TEXT_SEARCH,
   NUMBER,
   FLOAT,
   IS_BIGINT,
   BOOLEAN,
   DATE,
   TIME,
   DATETIME,
   HAS_TIMEZONE,
   BLOB,
   BIT,
   BINARY,
   UUID,
   SPATIAL,
   IS_MULTI_SPATIAL
};

describe('fieldTypes shape invariants', () => {
   for (const [label, arr] of Object.entries(allArrays)) {
      it(`${label} is a non-empty array of unique uppercase strings`, () => {
         expect(Array.isArray(arr)).toBe(true);
         expect(arr.length).toBeGreaterThan(0);
         expect(new Set(arr).size).toBe(arr.length);
         for (const t of arr) {
            expect(t).toBeTypeOf('string');
            expect(t).toBe(t.toUpperCase());
         }
      });
   }
});

describe('fieldTypes canonical membership', () => {
   it('TEXT contains CHAR/VARCHAR/CHARACTER/CHARACTER VARYING', () => {
      expect(TEXT).toEqual(expect.arrayContaining(['CHAR', 'VARCHAR', 'CHARACTER', 'CHARACTER VARYING']));
   });

   it('LONG_TEXT contains TEXT/MEDIUMTEXT/LONGTEXT/JSON', () => {
      expect(LONG_TEXT).toEqual(expect.arrayContaining(['TEXT', 'MEDIUMTEXT', 'LONGTEXT', 'JSON']));
   });

   it('NUMBER includes integer family (INT, BIGINT, SMALLINT, INTEGER, INT64)', () => {
      expect(NUMBER).toEqual(expect.arrayContaining(['INT', 'BIGINT', 'SMALLINT', 'INTEGER', 'INT64']));
   });

   it('NUMBER includes Postgres serial family (SERIAL, BIGSERIAL, SMALLSERIAL)', () => {
      expect(NUMBER).toEqual(expect.arrayContaining(['SERIAL', 'BIGSERIAL', 'SMALLSERIAL']));
   });

   it('FLOAT contains FLOAT/DECIMAL/DOUBLE/REAL/MONEY', () => {
      expect(FLOAT).toEqual(expect.arrayContaining(['FLOAT', 'DECIMAL', 'DOUBLE', 'REAL', 'MONEY']));
   });

   it('BOOLEAN contains BOOL/BOOLEAN', () => {
      expect(BOOLEAN).toEqual(['BOOL', 'BOOLEAN']);
   });

   it('DATE is exactly ["DATE"]', () => {
      expect(DATE).toEqual(['DATE']);
   });

   it('TIME contains TIME and TIME WITH TIME ZONE', () => {
      expect(TIME).toEqual(expect.arrayContaining(['TIME', 'TIME WITH TIME ZONE']));
   });

   it('DATETIME contains TIMESTAMP variants', () => {
      expect(DATETIME).toEqual(expect.arrayContaining([
         'DATETIME',
         'TIMESTAMP',
         'TIMESTAMP WITHOUT TIME ZONE',
         'TIMESTAMP WITH TIME ZONE'
      ]));
   });

   it('BLOB contains BLOB/TINYBLOB/MEDIUMBLOB/LONGBLOB/BYTEA', () => {
      expect(BLOB).toEqual(expect.arrayContaining([
         'BLOB',
         'TINYBLOB',
         'MEDIUMBLOB',
         'LONGBLOB',
         'BYTEA'
      ]));
   });

   it('BIT contains BIT and BIT VARYING', () => {
      expect(BIT).toEqual(['BIT', 'BIT VARYING']);
   });

   it('BINARY is exactly ["BINARY"]', () => {
      expect(BINARY).toEqual(['BINARY']);
   });

   it('UUID is exactly ["UUID"]', () => {
      expect(UUID).toEqual(['UUID']);
   });

   it('ARRAY contains ARRAY and ANYARRAY', () => {
      expect(ARRAY).toEqual(['ARRAY', 'ANYARRAY']);
   });

   it('TEXT_SEARCH contains TSVECTOR and TSQUERY', () => {
      expect(TEXT_SEARCH).toEqual(['TSVECTOR', 'TSQUERY']);
   });

   it('SPATIAL contains POINT/LINESTRING/POLYGON/GEOMETRY', () => {
      expect(SPATIAL).toEqual(expect.arrayContaining([
         'POINT',
         'LINESTRING',
         'POLYGON',
         'GEOMETRY'
      ]));
   });
});

describe('fieldTypes subset relationships', () => {
   it('IS_BIGINT is a subset of NUMBER ∪ FLOAT', () => {
      // BIGINT and BIGSERIAL are in NUMBER; DOUBLE PRECISION is in FLOAT
      const superset = new Set([...NUMBER, ...FLOAT]);
      for (const t of IS_BIGINT) expect(superset.has(t)).toBe(true);
   });

   it('HAS_TIMEZONE is a subset of TIME ∪ DATETIME', () => {
      const superset = new Set([...TIME, ...DATETIME]);
      for (const t of HAS_TIMEZONE) expect(superset.has(t)).toBe(true);
   });

   it('IS_MULTI_SPATIAL is a subset of SPATIAL', () => {
      const superset = new Set(SPATIAL);
      for (const t of IS_MULTI_SPATIAL) expect(superset.has(t)).toBe(true);
   });

   it('IS_MULTI_SPATIAL covers all multi-* spatial types', () => {
      expect(IS_MULTI_SPATIAL).toEqual(expect.arrayContaining([
         'MULTIPOINT',
         'MULTILINESTRING',
         'MULTIPOLYGON',
         'GEOMCOLLECTION',
         'GEOMETRYCOLLECTION'
      ]));
   });

   it('HAS_TIMEZONE contains both TIME WITH TIME ZONE and TIMESTAMP WITH TIME ZONE', () => {
      expect(HAS_TIMEZONE).toEqual(['TIMESTAMP WITH TIME ZONE', 'TIME WITH TIME ZONE']);
   });

   it('IS_BIGINT contains BIGINT, BIGSERIAL, DOUBLE PRECISION', () => {
      expect(IS_BIGINT).toEqual(['BIGINT', 'BIGSERIAL', 'DOUBLE PRECISION']);
   });
});
