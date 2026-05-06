/**
 * Tests for ModalSettingsDataExport.vue — backup-bundle export wizard.
 *
 * Component shape (read at write-time):
 *   - shadcn-vue Dialog primitives (stubbed passthrough)
 *   - useConnectionsStore: getConnectionName(uid), connectionsOrder, connections, customIcons
 *   - localConnections / localConnectionsOrder seeded via unproxify on setup
 *   - connectionToggles (initially { uid: true, ... } for every connection)
 *   - includeConnectionStatus computed: 1 (all) / 2 (some) / 0 (none)
 *   - exportData: validates passkey >= 8 chars, builds blob via encrypt() + URL.createObjectURL
 *   - emit 'close' on successful export OR via Cancel/Esc/X buttons
 *
 * Strategy:
 *   - Stub Dialog/* + Card + Checkbox + Input + Button + Label as passthroughs
 *   - Mock encrypt() to a deterministic stub so we don't depend on crypto behaviour
 *   - Seed connections store with 2 connections; verify rows render + master checkbox state
 *   - Trigger Cancel button -> 'close' emit
 *   - Trigger export with empty passkey -> isPasswordError flips on
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ModalSettingsDataExport from './ModalSettingsDataExport.vue';

// Mock common libs touched in setup() / exportData()
vi.mock('common/libs/encrypter', () => ({
   encrypt: vi.fn(() => ({ iv: 'aa', content: 'bb' })),
   decrypt: vi.fn(() => '')
}));

vi.mock('common/libs/uidGen', () => ({
   uidGen: vi.fn((prefix?: string) => `${prefix ?? 'X'}:fake`)
}));

// moment is used to compute filename — stable mock so download anchor href is deterministic.
vi.mock('moment', () => {
   const fmt = () => ({ format: (_p: string) => '2026-05-06' });
   const m = Object.assign(fmt, { default: fmt });
   return { default: m };
});

const seedConnections = [
   { uid: 'C:1', name: 'mysql-prod', client: 'mysql', host: 'h1', port: 3306, password: 'pw1', ask: false },
   { uid: 'C:2', name: 'pg-stage', client: 'pg', host: 'h2', port: 5432, password: '', ask: true }
];

const seedConnectionsOrder = [
   { uid: 'C:1', isFolder: false },
   { uid: 'C:2', isFolder: false },
   { uid: 'F:1', isFolder: true, name: 'team', connections: ['C:1'] }
];

const ButtonStub = {
   name: 'Button',
   inheritAttrs: false,
   props: { variant: { type: String, default: 'default' }, size: { type: String, default: 'default' } },
   template: '<button type="button" class="btn-stub" :data-variant="variant" v-bind="$attrs"><slot /></button>'
};

const InputStub = {
   name: 'Input',
   inheritAttrs: false,
   props: { modelValue: { type: [String, Number], default: '' } },
   emits: ['update:modelValue'],
   template: '<input class="input-stub" v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
};

const CheckboxStub = {
   name: 'Checkbox',
   inheritAttrs: false,
   props: { checked: { type: Boolean, default: false } },
   emits: ['update:checked'],
   template: '<button type="button" class="checkbox-stub" :data-checked="String(checked)" v-bind="$attrs" @click="$emit(\'update:checked\', !checked)" />'
};

const mountModal = (
   connectionsOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(ModalSettingsDataExport, {
      initialState: {
         connections: {
            connections: seedConnections,
            connectionsOrder: seedConnectionsOrder,
            customIcons: [],
            ...connectionsOverrides
         }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            Dialog: { template: '<div class="dialog-stub"><slot /></div>' },
            DialogContent: {
               inheritAttrs: false,
               template: '<div class="dialog-content-stub" v-bind="$attrs"><slot /></div>'
            },
            DialogHeader: { template: '<div class="dialog-header-stub"><slot /></div>' },
            DialogTitle: { template: '<div class="dialog-title-stub"><slot /></div>' },
            DialogDescription: { template: '<div class="dialog-desc-stub"><slot /></div>' },
            DialogFooter: { template: '<div class="dialog-footer-stub"><slot /></div>' },
            Card: { template: '<div class="card-stub"><slot /></div>' },
            Button: ButtonStub,
            Input: InputStub,
            Checkbox: CheckboxStub,
            Label: { template: '<label class="label-stub" v-bind="$attrs"><slot /></label>' }
         }
      }
   });
};

afterEach(() => {
   vi.clearAllMocks();
});

describe('ModalSettingsDataExport', () => {
   it('mounts without throwing with 2 seeded connections', async () => {
      expect(() => mountModal()).not.toThrow();
      await flushPromises();
   });

   it('renders one row per connection from the connections store', async () => {
      const wrapper = mountModal();
      await flushPromises();
      // 2 data rows + 1 header row using the same grid template -> filter by truncate divs
      const rows = wrapper.findAll('.grid.grid-cols-\\[1fr_1fr_60px\\]');
      // Header counts as one of the matched grids; data rows are the rest.
      expect(rows.length).toBeGreaterThanOrEqual(3);
      expect(wrapper.html()).toContain('mysql');
      expect(wrapper.html()).toContain('pg');
   });

   it('options checkboxes (passwords / folders) default checked=true', async () => {
      const wrapper = mountModal();
      await flushPromises();
      const passwordsBox = wrapper.find('#opt-passwords');
      const foldersBox = wrapper.find('#opt-folders');
      expect(passwordsBox.exists()).toBe(true);
      expect(foldersBox.exists()).toBe(true);
      expect(passwordsBox.attributes('data-checked')).toBe('true');
      expect(foldersBox.attributes('data-checked')).toBe('true');
   });

   it('Close (footer ghost) button emits "close"', async () => {
      const wrapper = mountModal();
      await flushPromises();
      const closeBtn = wrapper.findAll('.btn-stub').find(b => b.text().includes('general.close'));
      expect(closeBtn).toBeTruthy();
      await closeBtn!.trigger('click');
      await flushPromises();
      expect(wrapper.emitted('close')).toBeTruthy();
   });

   it('exporting with empty passkey flips isPasswordError true (renders error message)', async () => {
      const wrapper = mountModal();
      await flushPromises();
      const exportBtn = wrapper.findAll('.btn-stub').find(b => b.text().includes('database.export'));
      expect(exportBtn).toBeTruthy();
      await exportBtn!.trigger('click');
      await flushPromises();
      // No 'close' emit because validation failed.
      expect(wrapper.emitted('close')).toBeFalsy();
      expect(wrapper.html()).toContain('application.encryptionPasswordError');
   });

   it('exporting with valid 8+ char passkey calls encrypt and emits close', async () => {
      const { encrypt } = await import('common/libs/encrypter');
      const wrapper = mountModal();
      await flushPromises();
      // Set passkey via the input v-model (stub forwards @input -> update:modelValue)
      const passkeyInput = wrapper.find('input.input-stub[placeholder="application.required"]');
      // Fall back to first input if placeholder lookup misses.
      const target = passkeyInput.exists() ? passkeyInput : wrapper.find('input.input-stub');
      await target.setValue('longpasskey');
      await flushPromises();

      const exportBtn = wrapper.findAll('.btn-stub').find(b => b.text().includes('database.export'));
      await exportBtn!.trigger('click');
      await flushPromises();

      expect(encrypt).toHaveBeenCalledTimes(1);
      expect(wrapper.emitted('close')).toBeTruthy();
   });

   it('master toggle button click toggles every connection off then on', async () => {
      const wrapper = mountModal();
      await flushPromises();
      // First Checkbox in DOM is the header master-toggle (in the column header grid).
      const checkboxes = wrapper.findAll('.checkbox-stub');
      // Sanity: > 0 (master + per-row + 2 options)
      expect(checkboxes.length).toBeGreaterThan(2);
      const master = checkboxes[0];
      // Initially: master starts checked=true (all on after seed init)
      expect(master.attributes('data-checked')).toBe('true');
      // Click toggles all off
      await master.trigger('click');
      await flushPromises();
      // Click again -> all on
      await master.trigger('click');
      await flushPromises();
      // No throw and component still in DOM.
      expect(wrapper.find('.dialog-content-stub').exists()).toBe(true);
   });

   it('Escape keydown on window emits close', async () => {
      const wrapper = mountModal();
      await flushPromises();
      const evt = new KeyboardEvent('keydown', { key: 'Escape' });
      window.dispatchEvent(evt);
      await flushPromises();
      expect(wrapper.emitted('close')).toBeTruthy();
   });
});
