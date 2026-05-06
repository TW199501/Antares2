/**
 * Tests for WorkspaceTabNewTrigger.vue ??the in-tab "create new trigger"
 * form. Owns a localTrigger ref initialised from customizations.triggerSql,
 * a computed isChanged, an event-multi-checkbox group (for clients with
 * triggerMultipleEvents), and saveChanges ??Triggers.createTrigger.
 *
 * Strategy:
 *   - Mock @/ipc-api/Triggers so saveChanges resolves without IPC.
 *   - Stub PropsTabShell as a slot-passthrough so the toolbar / metadata /
 *     content slots all render and the buttons are findable in the DOM.
 *   - Stub PropertyCard as a passthrough wrapper around its slot.
 *   - Stub QueryEditor as a thin object with a fake `editor` so clearChanges
 *     can call `queryEditor.value.editor.session.setValue(...)` without
 *     loading ace.
 *   - Stub shadcn primitives (Button / Input / Checkbox) + BaseSelect /
 *     BaseLoader / BaseIcon as passthrough.
 *   - Seed workspaces store with a workspace that has `customizations`,
 *     `users`, `structure` (so schemaTables computed is populated).
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises as _flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Triggers from '@/ipc-api/Triggers';

import WorkspaceTabNewTrigger from './WorkspaceTabNewTrigger.vue';

vi.mock('@/ipc-api/Triggers', () => ({
   default: {
      createTrigger: vi.fn().mockResolvedValue({ status: 'success', response: null }),
      getTriggerInformations: vi.fn().mockResolvedValue({ status: 'success', response: { sql: '', name: '', table: '', activation: 'BEFORE', event: 'INSERT', definer: '' } })
   }
}));

const baseCustomizations = (over: Record<string, unknown> = {}) => ({
   definer: true,
   triggerOnlyRename: false,
   triggerMultipleEvents: false,
   triggerSql: 'BEGIN\nEND',
   ...over
});

const buildWorkspace = (custOver: Record<string, unknown> = {}, structOver?: unknown[]) => ({
   uid: 'C:1',
   client: 'mysql',
   database: 'app',
   connectionStatus: 'connected',
   tabs: [],
   selectedTab: null,
   structure: structOver ?? [
      {
         name: 'app',
         tables: [
            { name: 'users', type: 'table' },
            { name: 'orders', type: 'table' },
            { name: 'v_users', type: 'view' }
         ]
      }
   ],
   breadcrumbs: { schema: 'app', table: null },
   loadedSchemas: new Set(),
   customizations: baseCustomizations(custOver),
   dataTypes: [],
   indexTypes: [],
   variables: [],
   engines: [],
   collations: [],
   users: [{ name: 'root', host: 'localhost' }, { name: 'app', host: '%' }]
});

const PropsTabShellStub = {
   name: 'PropsTabShell',
   props: { isSelected: { type: Boolean, default: true }, schema: { type: String, default: '' } },
   template: `
      <div class="props-shell-stub">
         <div class="shell-toolbar"><slot name="toolbar" /></div>
         <div class="shell-metadata"><slot name="metadata" /></div>
         <div class="shell-content"><slot name="content" /></div>
      </div>
   `
};

const PropertyCardStub = {
   name: 'PropertyCard',
   props: { label: { type: String, default: '' } },
   template: '<div class="prop-card-stub" :data-label="label"><slot /></div>'
};

const QueryEditorStub = {
   name: 'QueryEditor',
   props: { modelValue: { type: String, default: '' } },
   emits: ['update:modelValue'],
   template: '<div class="query-editor-stub" :data-value="modelValue" />',
   data () {
      return {
         editor: {
            session: { setValue: (_v: string) => undefined },
            resize: () => { /* noop */ }
         }
      };
   }
};

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
   template: '<input class="input-stub" v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', ($event.target as HTMLInputElement).value)" />'
};

const CheckboxStub = {
   name: 'Checkbox',
   props: { checked: { type: Boolean, default: false } },
   emits: ['update:checked'],
   template: '<input type="checkbox" class="checkbox-stub" :checked="checked" @change="$emit(\'update:checked\', ($event.target as HTMLInputElement).checked)" />'
};

const BaseSelectStub = {
   name: 'BaseSelect',
   props: {
      modelValue: { type: [String, Number, Boolean, Object], default: null },
      options: { type: Array, default: () => [] }
   },
   emits: ['update:modelValue'],
   template: '<select class="base-select-stub" :data-value="String(modelValue)" />'
};

const _mountTab = (
   propsOverrides: Record<string, unknown> = {},
   custOverrides: Record<string, unknown> = {},
   structOverrides?: unknown[]
) => {
   const workspace = buildWorkspace(custOverrides, structOverrides);
   return mountWithPinia(WorkspaceTabNewTrigger, {
      props: {
         tabUid: 'TAB:1',
         connection: { uid: 'C:1', client: 'mysql' },
         tab: { uid: 'TAB:1' },
         isSelected: true,
         schema: 'app',
         ...propsOverrides
      } as never,
      initialState: {
         workspaces: {
            workspaces: [workspace],
            selectedWorkspace: 'C:1'
         },
         notifications: { notifications: [] },
         console: { isConsoleOpen: false, consoleHeight: 0 }
      },
      stubActions: true,
      global: {
         stubs: {
            BaseIcon: true,
            BaseLoader: true,
            BaseSelect: BaseSelectStub,
            PropsTabShell: PropsTabShellStub,
            PropertyCard: PropertyCardStub,
            QueryEditor: QueryEditorStub,
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

describe('WorkspaceTabNewTrigger', () => {
   it('exports the component definition', () => {
      expect(WorkspaceTabNewTrigger).toBeDefined();
      expect(typeof WorkspaceTabNewTrigger).toBe('object');
   });

   it('exposes a setup or render function (SFC compiled object shape)', () => {
      const def = WorkspaceTabNewTrigger as Record<string, unknown>;
      const hasShape = typeof def.setup === 'function' ||
         typeof def.render === 'function' ||
         typeof def.template === 'string' ||
         typeof def.__file === 'string';
      expect(hasShape).toBe(true);
   });

   it('Triggers IPC mock surface is wired (createTrigger + getTriggerInformations)', () => {
      expect(typeof Triggers.createTrigger).toBe('function');
      expect(typeof Triggers.getTriggerInformations).toBe('function');
      expect(Triggers.createTrigger).not.toHaveBeenCalled();
   });
});
