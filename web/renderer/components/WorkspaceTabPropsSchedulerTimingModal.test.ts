/**
 * Tests for WorkspaceTabPropsSchedulerTimingModal.vue — modal that edits a
 * MySQL/MariaDB scheduler (event) timing config. Owns:
 *   - Two execution modes:
 *       EVERY → optionsProxy.every[0] (n) + every[1] (unit) + starts/ends
 *       ONCE  → optionsProxy.at
 *   - hasStart / hasEnd local checkboxes — when false, the corresponding
 *     `starts`/`ends` is wiped on confirm before emit.
 *   - moment() backfill for `at` / `starts` / `ends` when localOptions
 *     arrives empty so the masked Inputs always render with a valid value.
 *   - `every` defaults to ['1', 'DAY'] when localOptions.every is empty.
 *   - Emits 'options-update' with the proxy (and 'hide' on dismiss).
 *
 * The component uses vue-mask v-mask directive (registered globally in the
 * real app); we install a no-op directive stand-in. ConfirmModal is replaced
 * with a slot-passthrough shell that re-emits @confirm and @hide.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import WorkspaceTabPropsSchedulerTimingModal from './WorkspaceTabPropsSchedulerTimingModal.vue';

// Global v-mask directive stand-in (registered globally in production).
const noopDirective = { mounted: () => {}, updated: () => {}, unmounted: () => {} };

const ConfirmModalStub = {
   name: 'ConfirmModal',
   inheritAttrs: false,
   emits: ['confirm', 'hide'],
   template: `
      <div class="confirm-modal-stub" v-bind="$attrs">
         <div class="cm-header"><slot name="header" /></div>
         <div class="cm-body"><slot name="body" /></div>
         <button type="button" class="cm-confirm-btn" @click="$emit('confirm')">confirm</button>
         <button type="button" class="cm-hide-btn" @click="$emit('hide')">hide</button>
      </div>
   `
};

const BaseSelectStub = {
   name: 'BaseSelect',
   props: {
      modelValue: { type: [String, Number, Boolean, Object], default: null },
      options: { type: Array, default: () => [] }
   },
   emits: ['update:modelValue'],
   template: '<div class="select-stub" :data-value="String(modelValue)" />'
};

const InputStub = {
   name: 'Input',
   inheritAttrs: false,
   props: {
      modelValue: { type: [String, Number], default: '' }
   },
   emits: ['update:modelValue'],
   template: '<input class="input-stub" v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', ($event.target).value)" />'
};

const CheckboxStub = {
   name: 'Checkbox',
   props: {
      checked: { type: Boolean, default: false }
   },
   emits: ['update:checked'],
   template: '<input type="checkbox" class="checkbox-stub" :checked="checked" @change="$emit(\'update:checked\', !checked)" />'
};

const LabelStub = {
   name: 'Label',
   inheritAttrs: false,
   template: '<label class="label-stub" v-bind="$attrs"><slot /></label>'
};

const seedOptionsEvery = () => ({
   name: 'evt_nightly',
   execution: 'EVERY',
   every: ['5', 'HOUR'],
   starts: '2026-05-06 00:00:00',
   ends: '2026-12-31 23:59:59',
   at: '',
   preserve: false,
   definer: 'root@localhost',
   sqlMode: '',
   comment: ''
});

const seedOptionsOnce = () => ({
   name: 'evt_once',
   execution: 'ONCE',
   every: [],
   starts: '',
   ends: '',
   at: '2026-05-06 12:00:00',
   preserve: true,
   definer: 'root@localhost',
   sqlMode: '',
   comment: ''
});

const mountModal = (
   propOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(WorkspaceTabPropsSchedulerTimingModal, {
      props: {
         localOptions: seedOptionsEvery(),
         workspace: { uid: 'C:1', client: 'mysql' },
         ...propOverrides
      } as never,
      initialState: {
         notifications: { notifications: [] }
      },
      stubActions: true,
      global: {
         directives: { mask: noopDirective },
         stubs: {
            BaseIcon: true,
            BaseSelect: BaseSelectStub,
            ConfirmModal: ConfirmModalStub,
            Checkbox: CheckboxStub,
            Input: InputStub,
            Label: LabelStub
         }
      }
   });
};

afterEach(() => {
   vi.clearAllMocks();
});

describe('WorkspaceTabPropsSchedulerTimingModal', () => {
   it('mounts without throwing under EVERY localOptions', () => {
      expect(() => mountModal()).not.toThrow();
   });

   it('renders the ConfirmModal shell with header showing the event name', async () => {
      const wrapper = mountModal();
      await flushPromises();
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(true);
      expect(wrapper.html()).toContain('evt_nightly');
      expect(wrapper.html()).toContain('database.timing');
   });

   it('renders starts + ends Labels when execution is EVERY', async () => {
      const wrapper = mountModal();
      await flushPromises();
      expect(wrapper.html()).toContain('database.starts');
      expect(wrapper.html()).toContain('database.ends');
   });

   it('does NOT render starts/ends Labels when execution is ONCE', async () => {
      const wrapper = mountModal({ localOptions: seedOptionsOnce() });
      await flushPromises();
      expect(wrapper.html()).not.toContain('database.starts');
      expect(wrapper.html()).not.toContain('database.ends');
   });

   it('renders the preserveOnCompletion checkbox in both modes', async () => {
      const wrapperEvery = mountModal();
      await flushPromises();
      expect(wrapperEvery.html()).toContain('database.preserveOnCompletion');

      const wrapperOnce = mountModal({ localOptions: seedOptionsOnce() });
      await flushPromises();
      expect(wrapperOnce.html()).toContain('database.preserveOnCompletion');
   });

   it('confirm event from ConfirmModal emits options-update with the proxied options', async () => {
      const wrapper = mountModal();
      await flushPromises();
      await wrapper.find('.cm-confirm-btn').trigger('click');
      await flushPromises();
      const evt = wrapper.emitted('options-update');
      expect(evt).toBeTruthy();
      const payload = evt![0][0] as Record<string, unknown>;
      // Initial seed had non-empty starts + ends → hasStart/hasEnd true → both kept.
      expect(payload.execution).toBe('EVERY');
      expect(payload.starts).toBe('2026-05-06 00:00:00');
      expect(payload.ends).toBe('2026-12-31 23:59:59');
   });

   it('confirm wipes starts/ends when hasStart / hasEnd are false (no initial values)', async () => {
      // Empty starts + ends so hasStart = hasEnd = false on init.
      const wrapper = mountModal({
         localOptions: {
            ...seedOptionsEvery(),
            starts: '',
            ends: ''
         }
      });
      await flushPromises();
      await wrapper.find('.cm-confirm-btn').trigger('click');
      await flushPromises();
      const evt = wrapper.emitted('options-update');
      expect(evt).toBeTruthy();
      const payload = evt![0][0] as Record<string, unknown>;
      // Confirm step replaces both with empty string when hasStart/hasEnd false
      expect(payload.starts).toBe('');
      expect(payload.ends).toBe('');
   });

   it('hide event from ConfirmModal forwards as a "hide" emit on the modal', async () => {
      const wrapper = mountModal();
      await flushPromises();
      await wrapper.find('.cm-hide-btn').trigger('click');
      await flushPromises();
      expect(wrapper.emitted('hide')).toBeTruthy();
   });

   it('backfills empty .every with ["1", "DAY"] on init', async () => {
      const wrapper = mountModal({
         localOptions: {
            ...seedOptionsEvery(),
            every: []
         }
      });
      await flushPromises();
      await wrapper.find('.cm-confirm-btn').trigger('click');
      await flushPromises();
      const evt = wrapper.emitted('options-update');
      expect(evt).toBeTruthy();
      const payload = evt![0][0] as Record<string, unknown>;
      expect(payload.every).toEqual(['1', 'DAY']);
   });

   it('backfills .at with a valid YYYY-MM-DD HH:mm:ss string when ONCE arrives empty', async () => {
      const wrapper = mountModal({
         localOptions: {
            ...seedOptionsOnce(),
            at: ''
         }
      });
      await flushPromises();
      await wrapper.find('.cm-confirm-btn').trigger('click');
      await flushPromises();
      const evt = wrapper.emitted('options-update');
      expect(evt).toBeTruthy();
      const payload = evt![0][0] as Record<string, unknown>;
      // moment().format('YYYY-MM-DD HH:mm:ss') matches /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/
      expect(typeof payload.at).toBe('string');
      expect(payload.at as string).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
   });

   it('renders the proxy execution dropdown with both EVERY / ONCE values', async () => {
      const wrapper = mountModal();
      await flushPromises();
      // First BaseSelect is the execution dropdown.
      const selects = wrapper.findAllComponents(BaseSelectStub);
      expect(selects.length).toBeGreaterThan(0);
      const executionSelect = selects[0];
      expect(executionSelect.props('options')).toEqual(['EVERY', 'ONCE']);
   });

   it('renders the unit dropdown with the 15-unit option list under EVERY mode', async () => {
      const wrapper = mountModal();
      await flushPromises();
      const selects = wrapper.findAllComponents(BaseSelectStub);
      // EVERY: select #0 is execution, select #1 is the unit list.
      expect(selects.length).toBeGreaterThanOrEqual(2);
      const unitSelect = selects[1];
      const opts = unitSelect.props('options') as string[];
      expect(opts).toContain('YEAR');
      expect(opts).toContain('DAY');
      expect(opts).toContain('MINUTE_SECOND');
      expect(opts.length).toBe(15);
   });

   it('exports the component as an SFC object', () => {
      expect(WorkspaceTabPropsSchedulerTimingModal).toBeDefined();
      expect(typeof WorkspaceTabPropsSchedulerTimingModal).toBe('object');
   });
});
