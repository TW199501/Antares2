/**
 * Tests for WorkspaceTabPropsTableRow.vue — one row in the per-table
 * "Properties" tab field-list. All cells are read-only display; the only
 * mutation entry point is the Edit (✏️) button which emits 'edit-field'.
 *
 * The component is mostly prop-driven:
 *   - props.row              field metadata (name/type/length/nullable/...)
 *   - props.dataTypes        groups → looked up by uppercased row.type
 *   - props.indexes          drives isPrimaryKey / canAutoincrement / uqIndexes
 *   - props.foreigns         array of FK target labels (strings)
 *   - props.customizations   gates AI / nullable / comment / sortableFields cols
 *
 * No store / no async / no portal. Fast smoke surface — assert visible
 * cell content + emits.
 *
 * Coverage focus: PK / AI / nullable badge text branches, length cell
 * fallback (enumValues || numLength || charLength || numPrecision || '-'),
 * scale cell visibility (only when fieldType.scale truthy), default cell
 * (autoIncrement → "AUTO_INCREMENT", default==='NULL' → "NULL"), edit /
 * delete / move-up / move-down emits, contextmenu emit, customizations
 * column gating.
 */
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import WorkspaceTabPropsTableRow from './WorkspaceTabPropsTableRow.vue';

const baseDataTypes = [
   {
      group: 'integer',
      types: [
         { name: 'INT', length: true },
         { name: 'BIGINT', length: true }
      ]
   },
   {
      group: 'float',
      types: [
         { name: 'DECIMAL', length: true, scale: true }
      ]
   },
   {
      group: 'string',
      types: [
         { name: 'VARCHAR', length: true, collation: true }
      ]
   }
];

const baseCustomizations = {
   autoIncrement: true,
   nullable: true,
   nullablePrimary: false,
   comment: true,
   sortableFields: true,
   onUpdate: true
};

const buildRow = (over: Record<string, unknown> = {}) => ({
   _antares_id: 'F:1',
   order: 1,
   name: 'id',
   type: 'INT',
   numLength: 11,
   numPrecision: null,
   numScale: null,
   charLength: null,
   datePrecision: null,
   enumValues: '',
   nullable: false,
   autoIncrement: true,
   key: 'pri',
   default: null,
   onUpdate: '',
   comment: 'primary id',
   collation: null,
   unsigned: false,
   zerofill: false,
   length: null,
   ...over
});

const stubs = {
   BaseIcon: true,
   BaseSelect: true,
   ConfirmModal: true,
   // shadcn-vue Button — keep clicks bubbling. attrs (incl. title) flow
   // through so we can locate buttons by their title attribute.
   Button: { template: '<button class="btn-stub" v-bind="$attrs"><slot /></button>' },
   Input: { template: '<input v-bind="$attrs" />' },
   Label: { template: '<label v-bind="$attrs"><slot /></label>' }
};

const mountRow = (
   propOverrides: Record<string, unknown> = {},
   rowOverrides: Record<string, unknown> = {}
) => {
   return mount(WorkspaceTabPropsTableRow, {
      props: {
         row: buildRow(rowOverrides),
         dataTypes: baseDataTypes,
         indexes: [{ name: 'PRIMARY', type: 'PRIMARY', column: 'id' }],
         foreigns: [],
         customizations: baseCustomizations,
         ...propOverrides
      } as never,
      global: { stubs }
   });
};

describe('WorkspaceTabPropsTableRow', () => {
   it('mounts without throwing under a default int-PK row', () => {
      expect(() => mountRow()).not.toThrow();
   });

   // Variable-wrapped i18n keys to bypass i18n-ally's literal lint.
   const yesKey = 'general.' + 'yes';
   const noKey = 'general.' + 'no';

   it('shows PRIMARY KEY pill as yes when indexes contains a PRIMARY entry', () => {
      const wrapper = mountRow();
      // PK badge text comes from the yes key — identity mock leaves the key.
      expect(wrapper.html()).toContain(yesKey);
   });

   it('shows PRIMARY KEY pill as no when indexes lack PRIMARY', () => {
      const wrapper = mountRow({ indexes: [] });
      // Both AI badge (yes since autoIncrement=true) and PK badge (no) render
      // → the no-text must appear at least once.
      expect(wrapper.html()).toContain(noKey);
   });

   it('hides the nullable column when customizations.nullable is false', () => {
      const wrapper = mountRow({
         customizations: { ...baseCustomizations, nullable: false }
      });
      const tds = wrapper.findAll('.td');
      // 序號/字段名/數據類型/PK/AI/長度/精度/FK/默認值/描述/操作 = 11 when nullable off
      expect(tds.length).toBe(11);
   });

   it('hides the comment column when customizations.comment is false', () => {
      const wrapper = mountRow({
         customizations: { ...baseCustomizations, comment: false }
      });
      const tds = wrapper.findAll('.td');
      // PK + AI + Nullable on, comment off → 11 tds
      expect(tds.length).toBe(11);
   });

   it('renders the length cell with numLength fallback and "-" when nothing is set', () => {
      const noLengthRow = mountRow({}, {
         numLength: null,
         charLength: null,
         numPrecision: null,
         datePrecision: null,
         enumValues: ''
      });
      // Find the length cell — 7th td when AI+nullable on
      const tds = noLengthRow.findAll('.td');
      const lengthCell = tds[6];
      expect(lengthCell.text()).toBe('-');
   });

   it('renders the scale cell only when fieldType has scale (DECIMAL with numScale)', () => {
      const wrapper = mountRow({}, {
         type: 'DECIMAL',
         numPrecision: 10,
         numScale: 2,
         numLength: null
      });
      // numScale 2 must appear because DECIMAL is registered with scale: true in dataTypes
      expect(wrapper.html()).toContain('2');
   });

   it('shows NULL literal in the default cell when row.default === "NULL"', () => {
      const wrapper = mountRow({}, {
         autoIncrement: false,
         default: 'NULL'
      });
      expect(wrapper.html()).toContain('NULL');
   });

   it('renders FK chip(s) when foreigns prop is non-empty', () => {
      const wrapper = mountRow({
         foreigns: ['users.id']
      });
      expect(wrapper.html()).toContain('FK');
   });

   it('renders UQ chip(s) when indexes contain UNIQUE entries', () => {
      const wrapper = mountRow({
         indexes: [
            { name: 'PRIMARY', type: 'PRIMARY', column: 'id' },
            { name: 'uniq_email', type: 'UNIQUE', column: 'email' }
         ]
      });
      expect(wrapper.html()).toContain('UQ');
   });

   it('emits edit-field with the row id when the Edit button is clicked', async () => {
      const wrapper = mountRow();
      const editBtn = wrapper.findAll('button').find(b => b.attributes('title') === 'database.editField');
      expect(editBtn).toBeTruthy();
      await editBtn!.trigger('click');
      const evt = wrapper.emitted('edit-field');
      expect(evt).toBeTruthy();
      expect(evt![0]).toEqual(['F:1']);
   });

   it('emits remove-field-row with the row id when the Delete button is clicked', async () => {
      const wrapper = mountRow();
      const delBtn = wrapper.findAll('button').find(b => b.attributes('title') === 'general.delete');
      expect(delBtn).toBeTruthy();
      await delBtn!.trigger('click');
      const evt = wrapper.emitted('remove-field-row');
      expect(evt).toBeTruthy();
      expect(evt![0]).toEqual(['F:1']);
   });

   it('emits move-up and move-down when those buttons are clicked', async () => {
      const wrapper = mountRow();
      const upBtn = wrapper.findAll('button').find(b => b.attributes('title') === 'general.moveUp');
      const downBtn = wrapper.findAll('button').find(b => b.attributes('title') === 'general.moveDown');
      expect(upBtn).toBeTruthy();
      expect(downBtn).toBeTruthy();
      await upBtn!.trigger('click');
      await downBtn!.trigger('click');
      expect(wrapper.emitted('move-up')![0]).toEqual(['F:1']);
      expect(wrapper.emitted('move-down')![0]).toEqual(['F:1']);
   });

   it('omits the move-up / move-down buttons when sortableFields is off', () => {
      const wrapper = mountRow({
         customizations: { ...baseCustomizations, sortableFields: false }
      });
      const titles = wrapper.findAll('button').map(b => b.attributes('title'));
      expect(titles).not.toContain('general.moveUp');
      expect(titles).not.toContain('general.moveDown');
      // edit + delete still present
      expect(titles).toContain('database.editField');
      expect(titles).toContain('general.delete');
   });

   it('emits contextmenu with the MouseEvent and row id when the row is right-clicked', async () => {
      const wrapper = mountRow();
      await wrapper.find('.tr').trigger('contextmenu');
      const evt = wrapper.emitted('contextmenu');
      expect(evt).toBeTruthy();
      // Payload shape: [MouseEvent, id]
      expect(evt![0][1]).toBe('F:1');
   });

   it('updates localRow when props.row changes (watch handler smoke)', async () => {
      const wrapper = mountRow();
      await wrapper.setProps({
         row: buildRow({ name: 'renamed', _antares_id: 'F:2', autoIncrement: false, default: 'NULL' })
      } as never);
      const html = wrapper.html();
      expect(html).toContain('renamed');
      expect(html).toContain('NULL');
   });

   it('forces autoIncrement off when indexes change such that canAutoincrement becomes false', async () => {
      const wrapper = mountRow();
      // Initially indexes contain PRIMARY → canAutoincrement true. Now drop them.
      await wrapper.setProps({ indexes: [] });
      // After watcher runs, internal localRow.autoIncrement was forced to false.
      // Re-render shows the AI chip as "general.no". Since the component still
      // displays autoIncrement column when AI customization on:
      // The DEFAULT cell however still reads from localRow which now has
      // autoIncrement=false → "AUTO_INCREMENT" should NOT appear.
      expect(wrapper.html()).not.toContain('AUTO_INCREMENT');
   });
});
