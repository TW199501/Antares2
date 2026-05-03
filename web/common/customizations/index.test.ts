/**
 * Characterization tests for the customizations contract.
 *
 * Per-client customizations objects act as feature-flag descriptors that
 * gate UI affordances ("does this DB support views? routines? schemas?").
 * They are the **.NET 10 backend rewrite contract** — the new sidecar
 * MUST faithfully advertise the same capabilities, and the renderer
 * relies on identical key shapes / boolean toggles.
 *
 * Two layers of verification:
 *
 *   Layer 1 — per-client snapshots: any change to a client's flag
 *             surface shows up as a snapshot diff in PR review. No
 *             accidental capability drift.
 *
 *   Layer 2 — cross-client shape consistency: every client's effective
 *             flag set must be a subset of the Customizations interface,
 *             and the two MANDATORY string fields (elementsWrapper,
 *             stringsWrapper) must be present in every client because
 *             their absence breaks SQL identifier quoting.
 */
import { describe, expect, it } from 'vitest';

import { defaults } from './defaults';
import customizations from './index';

const ALL_CLIENT_KEYS = ['maria', 'mysql', 'pg', 'mssql', 'sqlite', 'firebird'] as const;
type ClientKey = (typeof ALL_CLIENT_KEYS)[number];

describe('customizations index', () => {
   it('declares all expected client keys', () => {
      const actual = Object.keys(customizations).sort();
      expect(actual).toEqual([...ALL_CLIENT_KEYS].sort());
   });

   it('maria and mysql share the same customizations object (alias)', () => {
      // Locked: both keys point to the same module export
      expect(customizations.maria).toBe(customizations.mysql);
   });

   it.each(ALL_CLIENT_KEYS)('client %s exposes elementsWrapper + stringsWrapper (mandatory)', (client: ClientKey) => {
      const c = customizations[client];
      expect(typeof c.elementsWrapper).toBe('string');
      expect(typeof c.stringsWrapper).toBe('string');
   });

   it.each(ALL_CLIENT_KEYS)('client %s has only known Customizations keys', (client: ClientKey) => {
      const c = customizations[client] as unknown as Record<string, unknown>;
      const allowedKeys = new Set(Object.keys(defaults));
      const unexpected = Object.keys(c).filter(k => !allowedKeys.has(k));
      // Allow: keys that exist in the Customizations interface but not in
      // defaults — defaults is a baseline. Use a relaxed check: any key
      // outside this union is suspect.
      const interfaceOnlyKeys = new Set([
         'elementsWrapperEnd', 'materializedViews',
         'materializedViewAdd', 'materializedViewSettings'
      ]);
      const trulyUnexpected = unexpected.filter(k => !interfaceOnlyKeys.has(k));
      expect(trulyUnexpected).toEqual([]);
   });
});

describe('defaults', () => {
   it('is the all-OFF baseline (snapshot)', () => {
      expect(defaults).toMatchSnapshot();
   });

   it('has all boolean flags set to false', () => {
      const booleanFlags = Object.entries(defaults).filter(
         ([, v]) => typeof v === 'boolean'
      );
      expect(booleanFlags.length).toBeGreaterThan(0);
      for (const [k, v] of booleanFlags)
         expect(v, `defaults.${k}`).toBe(false);
   });
});

describe('per-client customization snapshots (.NET contract)', () => {
   it.each(ALL_CLIENT_KEYS)('snapshot for %s', (client: ClientKey) => {
      // Per-client snapshot — any flag flip / new feature / removal
      // surfaces in PR diff for explicit review.
      expect(customizations[client]).toMatchSnapshot();
   });
});
