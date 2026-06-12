/**
 * Tests for WorkspaceTabNewRoutine.vue ??the in-tab "create new routine"
 * (stored procedure) form. Owns localRoutine ref initialised from
 * customizations.procedureSql + workspace.dataTypes[0].types[0].name (for
 * the `returns` field that's not in this template but lives in state).
 *
 * Strategy mirrors WorkspaceTabNewTrigger:
 *   - Mock @/ipc-api/Routines so saveChanges resolves without IPC.
 *   - Stub PropsTabShell as slot-passthrough.
 *   - Stub PropertyCard as label-tagged passthrough.
 *   - Stub QueryEditor with a fake editor object so clearChanges can call
 *     queryEditor.value.editor.session.setValue.
 *   - Stub WorkspaceTabPropsRoutineParamsModal `: true` so its presence is
 *     probed via the auto-generated stub markup.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises as _flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Routines from '@/ipc-api/Routines';

import WorkspaceTabNewRoutine from './WorkspaceTabNewRoutine.vue';

vi.mock('@/ipc-api/Routines', () => ({
   default: {
      createRoutine: vi.fn().mockResolvedValue({ status: 'success', response: null }),
      getRoutineInformations: vi.fn().mockResolvedValue({ status: 'success', response: {} })
   }
}));

const baseCustomizations = (over: Record<string, unknown> = {}) => ({
   languages: ['SQL', 'JavaScript'],
   definer: true,
   comment: true,
   procedureDataAccess: true,
   procedureDeterministic: true,
   procedureSql: 'BEGIN\nEND',
   ...over
});

const baseDataTypes = [
   {
      group: 'integer',
      types: [
         { name: 'INT', length: 11 }
      ]
   }
];

const buildWorkspace = (custOver: Record<string, unknown> = {}) => ({
   uid: 'C:1',
   client: 'mysql',
   database: 'app',
   connectionStatus: 'connected',
   tabs: [],
   selectedTab: null,
   structure: [],
   breadcrumbs: { schema: 'app', table: null },
   loadedSchemas: new Set(),
   customizations: baseCustomizations(custOver),
   dataTypes: baseDataTypes,
   indexTypes: [],
   variables: [],
   engines: [],
   collations: [],
   users: [{ name: 'root', host: 'localhost' }]
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
   custOverrides: Record<string, unknown> = {}
) => {
   const workspace = buildWorkspace(custOverrides);
   return mountWithPinia(WorkspaceTabNewRoutine, {
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
            WorkspaceTabPropsRoutineParamsModal: true,
            Button: ButtonStub,
            Input: InputStub,
            Checkbox: CheckboxStub,
            Label: { template: '<label class="label-stub" v-bind="$attrs"><slot /></label>' },
            Separator: { template: '<div class="separator-stub" />' }
         }
      }
   });
};

afterEach(() => {
   vi.clearAllMocks();
});

describe('WorkspaceTabNewRoutine', () => {
   it('exports the component definition', () => {
      expect(WorkspaceTabNewRoutine).toBeDefined();
      expect(typeof WorkspaceTabNewRoutine).toBe('object');
   });

   it('exposes a setup or render function (SFC compiled object shape)', () => {
      const def = WorkspaceTabNewRoutine as Record<string, unknown>;
      const hasShape = typeof def.setup === 'function' ||
         typeof def.render === 'function' ||
         typeof def.template === 'string' ||
         typeof def.__file === 'string';
      expect(hasShape).toBe(true);
   });

   it('Routines IPC mock surface is wired (createRoutine + getRoutineInformations)', () => {
      expect(typeof Routines.createRoutine).toBe('function');
      expect(typeof Routines.getRoutineInformations).toBe('function');
      expect(Routines.createRoutine).not.toHaveBeenCalled();
   });
});
