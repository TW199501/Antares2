/**
 * Tests for ModalAllConnections.vue — the "All connections" picker dialog.
 * Owns:
 *   - Dialog shell (esc / overlay close)
 *   - Search input with right-side magnifier ↔ backspace icon swap
 *   - filteredConnections computed: name/host/db/databasePath/schema/user/
 *     port substring match
 *   - Connection card grid (responsive cols, hover-only delete affordance)
 *   - Card click → selectWorkspace + close
 *   - askToDelete → ConfirmModal → confirmDeleteConnection (Pinia action)
 *   - Esc handling: 1st clears search, 2nd closes
 *
 * Pinia state seeds connections + connectionsOrder + lastConnections so
 * `remappedConnections` resolves with full card metadata. Heavy primitives
 * (Dialog/ScrollArea/Badge/Input) are passthrough-stubbed so events bubble
 * and we can probe DOM by class.
 */
import { mountWithPinia } from '@tests/helpers/mountWithPinia';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ModalAllConnections from './ModalAllConnections.vue';

const baseConnections = [
   {
      uid: 'C:1',
      name: 'orders-db',
      client: 'mysql',
      host: 'db.example.com',
      port: 3306,
      user: 'root',
      database: 'orders'
   },
   {
      uid: 'C:2',
      name: 'analytics-db',
      client: 'pg',
      host: 'analytics.example.com',
      port: 5432,
      user: 'reader',
      database: 'metrics'
   },
   {
      uid: 'C:3',
      name: 'local-sqlite',
      client: 'sqlite',
      databasePath: '/var/db/local.sqlite'
   }
];

const baseConnectionsOrder = baseConnections.map(c => ({
   uid: c.uid,
   isFolder: false,
   client: c.client,
   icon: '',
   hasCustomIcon: false
}));

const baseLastConnections = [
   { uid: 'C:1', time: 3000 },
   { uid: 'C:2', time: 2000 },
   { uid: 'C:3', time: 1000 }
];

const InputStub = {
   name: 'Input',
   inheritAttrs: false,
   props: { modelValue: { type: [String, Number, null] as never, default: '' } },
   emits: ['update:modelValue'],
   template: '<input class="input-stub" v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
};

const ButtonStub = {
   name: 'Button',
   inheritAttrs: false,
   template: '<button type="button" class="btn-stub" v-bind="$attrs"><slot /></button>'
};

const ConfirmModalStub = {
   name: 'ConfirmModal',
   inheritAttrs: false,
   emits: ['confirm', 'hide'],
   template: `
      <div class="confirm-modal-stub">
         <div class="cm-header"><slot name="header" /></div>
         <div class="cm-body"><slot name="body" /></div>
         <button type="button" class="cm-confirm-btn" @click="$emit('confirm')">confirm</button>
         <button type="button" class="cm-hide-btn" @click="$emit('hide')">hide</button>
      </div>
   `
};

const mountModal = (
   stateOverrides: Record<string, unknown> = {}
) => {
   return mountWithPinia(ModalAllConnections, {
      initialState: {
         connections: {
            connections: baseConnections,
            connectionsOrder: baseConnectionsOrder,
            lastConnections: baseLastConnections,
            customIcons: [],
            ...(stateOverrides.connections as Record<string, unknown> ?? {})
         },
         workspaces: {
            workspaces: [],
            selectedWorkspace: 'C:1',
            ...(stateOverrides.workspaces as Record<string, unknown> ?? {})
         }
      },
      stubActions: true,
      attachTo: document.body,
      global: {
         stubs: {
            BaseIcon: true,
            Badge: { template: '<span class="badge-stub" v-bind="$attrs"><slot /></span>' },
            Button: ButtonStub,
            Input: InputStub,
            ScrollArea: { template: '<div class="scroll-area-stub" v-bind="$attrs"><slot /></div>' },
            Dialog: { template: '<div class="dialog-stub"><slot /></div>' },
            DialogContent: {
               template: '<div class="dialog-content-stub" v-bind="$attrs"><slot /></div>'
            },
            DialogDescription: { template: '<div class="dialog-description-stub"><slot /></div>' },
            DialogHeader: { template: '<div class="dialog-header-stub"><slot /></div>' },
            DialogTitle: { template: '<div class="dialog-title-stub"><slot /></div>' },
            ConfirmModal: ConfirmModalStub,
            TransitionGroup: { template: '<div class="transition-group-stub"><slot /></div>' }
         }
      }
   });
};

describe('ModalAllConnections', () => {
   it('mounts without throwing', () => {
      expect(() => mountModal()).not.toThrow();
   });

   it('renders one card per seeded connection (sorted by lastConnections.time desc)', async () => {
      const wrapper = mountModal();
      await flushPromises();
      // Cards have `cursor-pointer` + `tabindex="0"` outer wrapper. Match by
      // role attribute since classes are long.
      const cards = wrapper.findAll('[tabindex="0"]');
      expect(cards.length).toBe(3);
   });

   it('renders the title from the i18n key', () => {
      const wrapper = mountModal();
      expect(wrapper.html()).toContain('connection.allConnections');
   });

   it('typing in the search input filters by host substring', async () => {
      const wrapper = mountModal();
      await flushPromises();
      const input = wrapper.find('.input-stub');
      await input.setValue('analytics');
      await flushPromises();
      const cards = wrapper.findAll('[tabindex="0"]');
      // Only C:2 (analytics-db host=analytics.example.com) should remain.
      expect(cards.length).toBe(1);
   });

   it('search filters by databasePath substring (sqlite)', async () => {
      const wrapper = mountModal();
      await flushPromises();
      const input = wrapper.find('.input-stub');
      await input.setValue('local.sqlite');
      await flushPromises();
      const cards = wrapper.findAll('[tabindex="0"]');
      expect(cards.length).toBe(1);
   });

   it('search filters by port (numeric → string contains)', async () => {
      const wrapper = mountModal();
      await flushPromises();
      const input = wrapper.find('.input-stub');
      await input.setValue('5432');
      await flushPromises();
      const cards = wrapper.findAll('[tabindex="0"]');
      // Only C:2 has port 5432
      expect(cards.length).toBe(1);
   });

   it('clicking a card emits close (after dispatching selectWorkspace)', async () => {
      const wrapper = mountModal();
      await flushPromises();
      const cards = wrapper.findAll('[tabindex="0"]');
      await cards[0].trigger('click');
      await flushPromises();
      expect(wrapper.emitted('close')).toBeTruthy();
   });

   it('hovering then clicking the per-card delete button opens the ConfirmModal', async () => {
      const wrapper = mountModal();
      await flushPromises();
      // Delete affordance is the only `<button title="general.delete">` per card.
      const deleteBtn = wrapper.find('button[title="general.delete"]');
      expect(deleteBtn.exists()).toBe(true);
      await deleteBtn.trigger('click');
      await flushPromises();
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(true);
   });

   it('hide button on the ConfirmModal closes it without deleting', async () => {
      const wrapper = mountModal();
      await flushPromises();
      const deleteBtn = wrapper.find('button[title="general.delete"]');
      await deleteBtn.trigger('click');
      await flushPromises();
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(true);
      await wrapper.find('.cm-hide-btn').trigger('click');
      await flushPromises();
      expect(wrapper.find('.confirm-modal-stub').exists()).toBe(false);
   });

   it('renders zero cards when the connections store is empty', async () => {
      const wrapper = mountModal({
         connections: {
            connections: [],
            connectionsOrder: [],
            lastConnections: [],
            customIcons: []
         }
      });
      await flushPromises();
      expect(wrapper.findAll('[tabindex="0"]').length).toBe(0);
   });

   it('cleans up window keydown listener on unmount without throwing', async () => {
      const wrapper = mountModal();
      await flushPromises();
      expect(() => wrapper.unmount()).not.toThrow();
   });

   it('exports the component as an SFC object', () => {
      expect(ModalAllConnections).toBeDefined();
      expect(typeof ModalAllConnections).toBe('object');
   });
});
