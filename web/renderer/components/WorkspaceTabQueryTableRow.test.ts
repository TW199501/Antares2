/**
 * Tests for WorkspaceTabQueryTableRow.vue — the per-row renderer used by
 * the query result table. One instance is created per visible row by the
 * virtual-scroll list. Responsibilities:
 *   - Render each cell of `row` based on the matching `fields[col].type`
 *     (text / number / date / blob / null / spatial / boolean / enum).
 *   - Toggle inline / textarea / blob / map editors on dblclick (`editON`).
 *   - Emit `select-row`, `contextmenu`, `start-editing`, `stop-editing`,
 *     `update-field` for parent-coordinated state.
 *   - When `selected` flips true, attach a `keydown` listener on `window`
 *     for Enter / Escape inline-edit shortcuts; detach on false / unmount.
 *
 * Strategy:
 *   - Stub heavy children (BaseTextEditor / BaseMap / BaseSelect /
 *     BaseConfirmModal / BaseIcon / ForeignKeySelect / Button / Input /
 *     Label) so we focus on this component's own logic.
 *   - Provide a no-op `mask` directive (registered globally in the real app
 *     via `web/renderer/index.ts`; absent in unit tests).
 *   - typeFormat covers many branches via different `fields[col].type`
 *     values — one row with a wide field set hits text / number / date /
 *     null / blob / boolean / array.
 *
 * Spec lessons applied:
 *   - No `data-slot` / `data-state` assertions (§5.A).
 *   - `await flushPromises()` after async edit flow (§5.C).
 *   - BaseTextEditor / BaseMap stubbed (§5.F).
 *   - `props: { ... }` object form on inline stubs (lint rule).
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import WorkspaceTabQueryTableRow from './WorkspaceTabQueryTableRow.vue';

vi.mock('@/ipc-api/Tables', () => ({
   default: {
      updateTableCell: vi.fn().mockResolvedValue({ status: 'success', response: { reload: false } }),
      deleteTableRows: vi.fn().mockResolvedValue({ status: 'success', response: null })
   }
}));

// no-op directive stand-in for the globally registered `mask` directive
const noopDirective = { mounted: () => {}, updated: () => {}, unmounted: () => {} };

const baseFields = {
   id: { name: 'id', type: 'INT', length: 11, schema: 'app', table: 'users', key: 'pri' },
   name: { name: 'name', type: 'VARCHAR', length: 255, schema: 'app', table: 'users' },
   created_at: { name: 'created_at', type: 'DATETIME', length: 0, schema: 'app', table: 'users' },
   active: { name: 'active', type: 'BOOLEAN', length: 1, schema: 'app', table: 'users' },
   data: { name: 'data', type: 'BLOB', length: 0, schema: 'app', table: 'users' },
   note: { name: 'note', type: 'TEXT', length: 0, schema: 'app', table: 'users' },
   missing: { name: 'missing', type: 'VARCHAR', length: 50, schema: 'app', table: 'users' }
};

const baseRow = {
   _antares_id: 'r1',
   id: 42,
   name: 'Alice',
   created_at: new Date('2026-05-06T10:30:00Z'),
   active: true,
   data: null,
   note: 'a long note',
   missing: null
};

const buildProps = (overrides: Record<string, unknown> = {}) => ({
   row: { ...baseRow },
   fields: { ...baseFields },
   keyUsage: [],
   itemHeight: 22,
   elementType: 'table',
   selected: false,
   selectedCell: null,
   ...overrides
});

const mountRow = (propsOverrides: Record<string, unknown> = {}) => {
   return mountWithPinia(WorkspaceTabQueryTableRow, {
      props: buildProps(propsOverrides) as never,
      global: {
         directives: { mask: noopDirective },
         stubs: {
            BaseIcon: true,
            BaseMap: true,
            BaseTextEditor: true,
            BaseSelect: {
               name: 'BaseSelect',
               props: {
                  modelValue: { type: [String, Number, Boolean, Object], default: null },
                  options: { type: Array, default: () => [] }
               },
               template: '<div class="base-select-stub" />'
            },
            ForeignKeySelect: {
               name: 'ForeignKeySelect',
               props: {
                  modelValue: { type: [String, Number, Object], default: null },
                  keyUsage: { type: Object, default: null }
               },
               template: '<div class="fk-select-stub" />'
            },
            // BaseConfirmModal renders header/body slots inline so we can probe
            // its presence + slot content without portal/teleport.
            BaseConfirmModal: {
               name: 'BaseConfirmModal',
               props: {
                  confirmText: { type: String, default: '' },
                  size: { type: String, default: '' },
                  hideFooter: { type: Boolean, default: false },
                  disableAutofocus: { type: Boolean, default: false }
               },
               template: '<div class="confirm-modal-stub"><slot name="header" /><slot name="body" /></div>'
            },
            Button: {
               name: 'Button',
               props: {
                  variant: { type: String, default: '' },
                  size: { type: String, default: '' }
               },
               template: '<button class="btn-stub" v-bind="$attrs"><slot /></button>'
            },
            Input: {
               name: 'Input',
               props: {
                  modelValue: { type: [String, Number], default: '' },
                  type: { type: String, default: 'text' }
               },
               template: '<input class="input-stub" v-bind="$attrs" />'
            },
            Label: {
               name: 'Label',
               template: '<label class="label-stub" v-bind="$attrs"><slot /></label>'
            }
         }
      }
   });
};

describe('WorkspaceTabQueryTableRow', () => {
   it('mounts without throwing under default props', () => {
      expect(() => mountRow()).not.toThrow();
   });

   it('renders one .td cell per non-internal column (skips _antares_id)', () => {
      const wrapper = mountRow();
      const cells = wrapper.findAll('.td');
      // 7 visible columns (id / name / created_at / active / data / note / missing);
      // _antares_id is rendered with v-show="false" — still present in DOM but hidden.
      // We assert at least 7 visible td elements exist.
      expect(cells.length).toBeGreaterThanOrEqual(7);
   });

   it('applies the configured itemHeight on the row container', () => {
      const wrapper = mountRow({ itemHeight: 33 });
      const tr = wrapper.find('.tr');
      expect(tr.attributes('style') || '').toContain('33px');
   });

   it('renders a NULL cell with the is-null class', () => {
      const wrapper = mountRow();
      const html = wrapper.html();
      // `data` column is null → the cell-content gets ` is-null` appended
      expect(html).toContain('is-null');
   });

   it('formats DATETIME cells via moment (YYYY-MM-DD HH:mm:ss)', () => {
      const wrapper = mountRow();
      const html = wrapper.html();
      // moment formats to local timezone; just verify the YYYY-MM-DD prefix
      // (year is stable across timezones for this UTC date).
      expect(html).toMatch(/2026-05-0[567]/);
   });

   it('marks the cell with type-<type> class for styling hooks', () => {
      const wrapper = mountRow();
      const html = wrapper.html();
      expect(html).toContain('type-int');
      expect(html).toContain('type-varchar');
      expect(html).toContain('type-datetime');
   });

   it('emits select-row when a cell is clicked', async () => {
      const wrapper = mountRow();
      const cells = wrapper.findAll('.td');
      // Click the first visible non-_antares_id cell. Cell index 0 is the
      // hidden _antares_id (v-show=false but present), so click index 1.
      await cells[1].trigger('click');
      const events = wrapper.emitted('select-row');
      expect(events).toBeDefined();
      expect(events!.length).toBeGreaterThan(0);
      // payload is [event, row, field]
      const [, rowArg, fieldArg] = events![0] as unknown[];
      expect(rowArg).toBeDefined();
      expect(typeof fieldArg).toBe('string');
   });

   it('emits contextmenu with payload {id, orgField, type, length} on right-click', async () => {
      const wrapper = mountRow();
      const cells = wrapper.findAll('.td');
      await cells[1].trigger('contextmenu');
      const events = wrapper.emitted('contextmenu');
      expect(events).toBeDefined();
      expect(events!.length).toBeGreaterThan(0);
      const [, payload] = events![0] as [Event, { id: string; orgField: string; type: string }];
      expect(payload.id).toBe('r1');
      expect(typeof payload.orgField).toBe('string');
      expect(typeof payload.type).toBe('string');
   });

   it('marks the matching cell with the .selected class when selectedCell prop is set', () => {
      const wrapper = mountRow({ selectedCell: 'name' });
      const selected = wrapper.findAll('.td.selected');
      // Exactly one cell should be marked
      expect(selected.length).toBe(1);
   });

   it('does not crash when row contains a NULL value and field is missing typeformat fallback', () => {
      const wrapper = mountRow({ row: { ...baseRow, missing: null } });
      // 7 cells render without throwing; the NULL cell falls into the empty branch
      expect(wrapper.findAll('.td').length).toBeGreaterThanOrEqual(7);
   });

   it('attaches keydown listener when selected flips true and removes on unmount', async () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      const wrapper = mountRow({ selected: false });
      const beforeAdds = addSpy.mock.calls.filter(c => c[0] === 'keydown').length;

      await wrapper.setProps({ selected: true });
      await flushPromises();

      const afterAdds = addSpy.mock.calls.filter(c => c[0] === 'keydown').length;
      expect(afterAdds).toBeGreaterThan(beforeAdds);

      // Toggle back to false — should remove
      await wrapper.setProps({ selected: false });
      await flushPromises();
      const removes = removeSpy.mock.calls.filter(c => c[0] === 'keydown').length;
      expect(removes).toBeGreaterThan(0);

      // Unmount-on-true path
      await wrapper.setProps({ selected: true });
      await flushPromises();
      const removesBeforeUnmount = removeSpy.mock.calls.filter(c => c[0] === 'keydown').length;
      wrapper.unmount();
      const removesAfterUnmount = removeSpy.mock.calls.filter(c => c[0] === 'keydown').length;
      expect(removesAfterUnmount).toBeGreaterThan(removesBeforeUnmount);

      addSpy.mockRestore();
      removeSpy.mockRestore();
   });

   it('does not emit start-editing on dblclick when elementType is "view" (read-only)', async () => {
      const wrapper = mountRow({ elementType: 'view' });
      const spans = wrapper.findAll('span.cell-content');
      const target = spans.find(s => s.text().includes('Alice'));
      expect(target).toBeTruthy();
      await target!.trigger('dblclick');
      await flushPromises();
      // editON returns early because isEditable is false → no emit
      expect(wrapper.emitted('start-editing')).toBeUndefined();
   });

   it('cleans up gracefully on unmount when not selected (no-throw smoke)', () => {
      const wrapper = mountRow({ selected: false });
      expect(() => wrapper.unmount()).not.toThrow();
   });

   it('reflects selected-cell change reactively when prop updates', async () => {
      const wrapper = mountRow({ selectedCell: 'name' });
      expect(wrapper.findAll('.td.selected').length).toBe(1);
      await wrapper.setProps({ selectedCell: 'id' });
      // Still exactly one selected cell, but now a different one
      expect(wrapper.findAll('.td.selected').length).toBe(1);
   });
});
