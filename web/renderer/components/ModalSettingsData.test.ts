/**
 * Tests for ModalSettingsData.vue — the "Data" tab content of the settings
 * modal. Two cards: "Export Data" and "Import Data"; each owns a Button that
 * flips a local ref (isExportModal / isImportModal) and renders the matching
 * child modal (ModalSettingsDataExport / ModalSettingsDataImport) v-if-gated.
 *
 * Strategy: stub Card / CardHeader / Button / BaseIcon as passthroughs, and
 * stub the two child modals as named placeholders so we can assert v-if state
 * by querying their stub class. Click each button + assert the corresponding
 * child modal renders, then re-emit @close from the stub and assert it
 * disappears.
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ModalSettingsData from './ModalSettingsData.vue';

const ButtonStub = {
   name: 'Button',
   inheritAttrs: false,
   props: { variant: { type: String, default: 'default' } },
   template: '<button type="button" class="btn-stub" :data-variant="variant" v-bind="$attrs"><slot /></button>'
};

const ExportModalStub = {
   name: 'ModalSettingsDataExport',
   emits: ['close'],
   template: '<div class="export-modal-stub"><button type="button" class="x-close" @click="$emit(\'close\')">x</button></div>'
};

const ImportModalStub = {
   name: 'ModalSettingsDataImport',
   emits: ['close'],
   template: '<div class="import-modal-stub"><button type="button" class="x-close" @click="$emit(\'close\')">x</button></div>'
};

const mountModal = () => {
   return mount(ModalSettingsData, {
      global: {
         stubs: {
            BaseIcon: true,
            Card: { template: '<div class="card-stub"><slot /></div>' },
            CardHeader: { template: '<div class="card-header-stub"><slot /></div>' },
            CardTitle: { template: '<div class="card-title-stub"><slot /></div>' },
            CardDescription: { template: '<div class="card-desc-stub"><slot /></div>' },
            CardContent: { template: '<div class="card-content-stub"><slot /></div>' },
            Button: ButtonStub,
            ModalSettingsDataExport: ExportModalStub,
            ModalSettingsDataImport: ImportModalStub
         }
      }
   });
};

describe('ModalSettingsData', () => {
   it('mounts without throwing', () => {
      expect(() => mountModal()).not.toThrow();
   });

   it('renders two Card sections (export + import)', () => {
      const wrapper = mountModal();
      expect(wrapper.findAll('.card-stub').length).toBe(2);
      expect(wrapper.html()).toContain('application.exportData');
      expect(wrapper.html()).toContain('application.importData');
   });

   it('does not render either child modal initially', () => {
      const wrapper = mountModal();
      expect(wrapper.find('.export-modal-stub').exists()).toBe(false);
      expect(wrapper.find('.import-modal-stub').exists()).toBe(false);
   });

   it('renders the export button as variant=default and the import button as variant=secondary', () => {
      const wrapper = mountModal();
      const buttons = wrapper.findAll('.btn-stub');
      expect(buttons.length).toBe(2);
      expect(buttons[0].attributes('data-variant')).toBe('default');
      expect(buttons[1].attributes('data-variant')).toBe('secondary');
   });

   it('clicking the export button toggles ModalSettingsDataExport on', async () => {
      const wrapper = mountModal();
      const buttons = wrapper.findAll('.btn-stub');
      await buttons[0].trigger('click');
      expect(wrapper.find('.export-modal-stub').exists()).toBe(true);
      expect(wrapper.find('.import-modal-stub').exists()).toBe(false);
   });

   it('clicking the import button toggles ModalSettingsDataImport on', async () => {
      const wrapper = mountModal();
      const buttons = wrapper.findAll('.btn-stub');
      await buttons[1].trigger('click');
      expect(wrapper.find('.import-modal-stub').exists()).toBe(true);
      expect(wrapper.find('.export-modal-stub').exists()).toBe(false);
   });

   it('child @close from the export modal flips it back off', async () => {
      const wrapper = mountModal();
      const buttons = wrapper.findAll('.btn-stub');
      await buttons[0].trigger('click');
      expect(wrapper.find('.export-modal-stub').exists()).toBe(true);
      // Trigger the stub's internal close button which re-emits @close
      await wrapper.find('.export-modal-stub .x-close').trigger('click');
      expect(wrapper.find('.export-modal-stub').exists()).toBe(false);
   });

   it('child @close from the import modal flips it back off', async () => {
      const wrapper = mountModal();
      const buttons = wrapper.findAll('.btn-stub');
      await buttons[1].trigger('click');
      expect(wrapper.find('.import-modal-stub').exists()).toBe(true);
      await wrapper.find('.import-modal-stub .x-close').trigger('click');
      expect(wrapper.find('.import-modal-stub').exists()).toBe(false);
   });

   it('exports the component as an SFC object', () => {
      expect(ModalSettingsData).toBeDefined();
      expect(typeof ModalSettingsData).toBe('object');
   });
});
