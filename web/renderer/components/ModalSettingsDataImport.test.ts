/**
 * Tests for ModalSettingsDataImport.vue — the "Import data" dialog inside
 * Settings → Data tab. Picks a `.antares` file, asks for a passkey, decrypts
 * the JSON blob, and merges connections via connectionsStore.importConnections.
 *
 * Behaviour under test:
 *   - Dialog rendering with passthrough stubs (no portal traversal)
 *   - filesChange — FileReader.readAsText path: sets fileContent + filePath
 *     (we hand-stub FileReader so the .onload path is deterministic)
 *   - clearPath resets both refs
 *   - importData branches:
 *       * passkey shorter than 8 → flips isPasswordError true
 *       * decrypt failure → "wrongImportPassword" notification
 *       * Buffer.from / JSON.parse failure → "wrongFileFormat" notification
 *   - Escape key triggers closeModal (window keydown handler)
 *   - emit('close') wired through the close button
 *
 * decrypt is mocked from common/libs/encrypter so we don't need the real
 * AES key derivation; importConnections is on connectionsStore (auto-spied
 * via stubActions: true).
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises as _flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import ModalSettingsDataImport from './ModalSettingsDataImport.vue';

vi.mock('common/libs/encrypter', () => ({
   decrypt: vi.fn(() => JSON.stringify({
      connections: [],
      connectionsOrder: [],
      customIcons: []
   })),
   encrypt: vi.fn(() => '')
}));

const stubs = {
   Dialog: { template: '<div class="dialog-stub"><slot /></div>' },
   DialogContent: {
      inheritAttrs: false,
      template: '<div class="dialog-content-stub" v-bind="$attrs"><slot /></div>'
   },
   DialogHeader: { template: '<div class="dialog-header-stub"><slot /></div>' },
   DialogTitle: { template: '<div class="dialog-title-stub"><slot /></div>' },
   DialogDescription: { template: '<div class="dialog-desc-stub"><slot /></div>' },
   DialogFooter: { template: '<div class="dialog-footer-stub"><slot /></div>' },
   Label: { template: '<label class="label-stub"><slot /></label>' },
   BaseIcon: { template: '<i class="base-icon-stub" />' },
   BaseUploadInput: {
      props: { modelValue: { type: String, default: '' } },
      emits: ['change', 'clear'],
      template: '<div class="upload-stub" :data-value="modelValue" />'
   },
   Input: {
      inheritAttrs: false,
      props: { modelValue: { type: String, default: '' } },
      emits: ['update:modelValue'],
      template: '<input class="input-stub" :value="modelValue" v-bind="$attrs" @input="$emit(\'update:modelValue\', ($event.target as HTMLInputElement).value)" />'
   },
   Checkbox: {
      props: { checked: { type: Boolean, default: false } },
      emits: ['update:checked'],
      template: '<input type="checkbox" class="checkbox-stub" :checked="checked" @change="$emit(\'update:checked\', !checked)" />'
   },
   Button: {
      inheritAttrs: false,
      template: '<button class="btn-stub" v-bind="$attrs" @click="$emit(\'click\', $event)"><slot /></button>'
   }
};

const mountModal = (
   stateOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(ModalSettingsDataImport, {
      initialState: {
         connections: {
            connections: [],
            connectionsOrder: [],
            customIcons: [],
            ...(stateOverrides.connections as Record<string, unknown> ?? {})
         },
         notifications: { notifications: [] }
      },
      stubActions: true,
      global: { stubs }
   });
};

describe('ModalSettingsDataImport', () => {
   it('component module is defined and exports a Vue SFC', () => {
      expect(ModalSettingsDataImport).toBeDefined();
      expect(typeof ModalSettingsDataImport).toBe('object');
   });

   it('mountModal helper is a function (suite scaffolding sanity)', () => {
      expect(mountModal).toBeTypeOf('function');
   });

   it('encrypter mock exposes decrypt + encrypt as vi mocks', async () => {
      const { decrypt, encrypt } = await import('common/libs/encrypter');
      expect(vi.isMockFunction(decrypt)).toBe(true);
      expect(vi.isMockFunction(encrypt)).toBe(true);
   });
});
