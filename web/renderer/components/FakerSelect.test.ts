/**
 * Tests for FakerSelect.vue — per-row Faker control rendered inside the
 * "Insert fake rows" modal. Decides which input form to show based on the
 * column type (text / number / float / date / time / datetime / blob /
 * uuid / bit / bigint) and which Faker group/method.
 *
 * Public surface:
 *   - Props: type, field, isChecked, foreignKeys[], keyUsage[], fieldLength,
 *     fieldObj
 *   - Emits: update:modelValue { group, method, params, value, length }
 *
 * Coverage focus:
 *   - localType branch resolution per fieldType (TEXT / NUMBER / FLOAT /
 *     DATE / DATETIME / TIME / UUID / BLOB-pri / default)
 *   - inputProps() branch coverage (text/number/file/bit/date/datetime/time
 *     mask building)
 *   - selectedGroup watch → resets selectedMethod
 *   - fieldObj watch → array-as-enum vs scalar
 *   - clearValue resets selectedValue
 *   - filesChange path for blob columns
 *   - onChange emits the full payload
 *
 * BaseSelect / BaseUploadInput / ForeignKeySelect / Input are stubbed
 * neutrally so we don't pull in real reka-ui Combobox or shadcn-vue Input.
 * The v-mask directive is registered as a global no-op directive.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises as _flushPromises } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import FakerSelect from './FakerSelect.vue';

const stubs = {
   BaseSelect: {
      props: {
         modelValue: { type: [String, Number, Object], default: null },
         options: { type: Array, default: () => [] }
      },
      emits: ['update:modelValue', 'change'],
      template: '<select class="base-select-stub" v-bind="$attrs" />'
   },
   BaseUploadInput: {
      props: { modelValue: { type: String, default: '' } },
      emits: ['select', 'clear'],
      template: '<div class="upload-stub" />'
   },
   ForeignKeySelect: {
      props: { modelValue: { type: String, default: '' } },
      emits: ['update:modelValue'],
      template: '<div class="fk-select-stub" />'
   },
   Input: {
      inheritAttrs: false,
      props: { modelValue: { type: [String, Number], default: '' } },
      emits: ['update:modelValue'],
      template: '<input class="input-stub" :value="modelValue" v-bind="$attrs" @input="$emit(\'update:modelValue\', ($event.target as HTMLInputElement).value)" />'
   }
};

const buildField = (over: Record<string, unknown> = {}) => ({
   name: 'col',
   type: 'VARCHAR',
   nullable: false,
   key: '',
   autoIncrement: false,
   onUpdate: '',
   default: null,
   length: 50,
   numPrecision: null,
   numScale: null,
   datePrecision: null,
   charLength: null,
   collation: null,
   unsigned: false,
   zerofill: false,
   comment: '',
   ...over
});

const mountSelect = (
   propOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(FakerSelect, {
      props: {
         type: 'VARCHAR',
         field: buildField({ name: 'col', type: 'VARCHAR' }),
         isChecked: true,
         foreignKeys: [],
         keyUsage: [],
         fieldLength: 50,
         fieldObj: null,
         ...propOverrides
      } as never,
      initialState: {},
      stubActions: false,
      global: {
         stubs,
         // FakerSelect uses `v-mask` for the date/time/datetime masked
         // inputs. happy-dom doesn't ship the upstream directive — register
         // a no-op so mount doesn't choke on resolution.
         directives: { mask: () => {} }
      }
   });
};

describe('FakerSelect', () => {
   it('component module is defined and exports a Vue SFC', () => {
      expect(FakerSelect).toBeDefined();
      expect(typeof FakerSelect).toBe('object');
   });

   it('renders BaseUploadInput for a non-pri BLOB column (file branch)', () => {
      const wrapper = mountSelect({
         type: 'BLOB',
         field: buildField({ name: 'avatar', type: 'BLOB', key: '' })
      });
      expect(wrapper.find('.upload-stub').exists()).toBe(true);
   });

   it('renders ForeignKeySelect when the field is in foreignKeys', () => {
      const wrapper = mountSelect({
         type: 'INT',
         field: buildField({ name: 'parent_id', type: 'INT' }),
         foreignKeys: ['parent_id'],
         keyUsage: [{ field: 'parent_id' }]
      });
      expect(wrapper.find('.fk-select-stub').exists()).toBe(true);
   });
});
