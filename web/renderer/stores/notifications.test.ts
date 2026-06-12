/**
 * notifications store — Pinia store tests (T9 / PR5).
 *
 * Tested behaviors:
 *   - addNotification: prepends to notifications, assigns uid prefixed 'N:',
 *     dispatches the matching vue-sonner toast variant
 *   - addNotification falls back to the bare `toast(message)` when status is
 *     not a recognized variant (success/error/warning/info)
 *   - addNotification mirrors the message into the console store's debug logs
 *   - removeNotification(uid): drops only the matching entry
 */
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'vue-sonner';

import { useConsoleStore } from './console';
import { useNotificationsStore } from './notifications';

vi.mock('vue-sonner', () => {
   const base = vi.fn();
   return {
      toast: Object.assign(base, {
         success: vi.fn(),
         error: vi.fn(),
         warning: vi.fn(),
         info: vi.fn()
      })
   };
});

describe('notifications store', () => {
   beforeEach(() => {
      setActivePinia(createPinia());
   });

   it('starts with an empty notifications array', () => {
      const store = useNotificationsStore();
      expect(store.notifications).toEqual([]);
   });

   it('addNotification prepends and assigns a uid with the "N:" prefix', () => {
      const store = useNotificationsStore();
      store.addNotification({ status: 'success', message: 'Saved!' });
      store.addNotification({ status: 'info', message: 'Later' });

      expect(store.notifications).toHaveLength(2);
      // newest is at index 0 (unshift)
      expect(store.notifications[0].message).toBe('Later');
      expect(store.notifications[1].message).toBe('Saved!');
      expect(store.notifications[0].uid).toMatch(/^N:/);
      expect(store.notifications[1].uid).toMatch(/^N:/);
   });

   it('addNotification dispatches the matching vue-sonner variant when status matches', () => {
      const store = useNotificationsStore();
      store.addNotification({ status: 'success', message: 'Saved!' });
      expect(toast.success).toHaveBeenCalledWith('Saved!');
      expect(toast.error).not.toHaveBeenCalled();
   });

   it('addNotification falls back to bare toast() when status is unknown', () => {
      const store = useNotificationsStore();
      store.addNotification({ status: 'unknown-variant', message: 'Hi' });
      // The bare toast (the `toast` function itself) should be called.
      expect(toast).toHaveBeenCalledWith('Hi');
   });

   it('addNotification mirrors the message into the console store debug log', () => {
      const consoleStore = useConsoleStore();
      const store = useNotificationsStore();
      store.addNotification({ status: 'success', message: 'Saved!' });
      expect(consoleStore.debugLogs).toHaveLength(1);
      expect(consoleStore.debugLogs[0]).toMatchObject({
         level: 'success',
         process: 'renderer',
         message: 'Saved!'
      });
      expect(consoleStore.debugLogs[0].date).toBeInstanceOf(Date);
   });

   it('removeNotification drops only the matching uid', () => {
      const store = useNotificationsStore();
      store.addNotification({ status: 'info', message: 'a' });
      store.addNotification({ status: 'info', message: 'b' });
      const survivorUid = store.notifications[0].uid; // 'b'
      const targetUid = store.notifications[1].uid; // 'a'

      store.removeNotification(targetUid);
      expect(store.notifications).toHaveLength(1);
      expect(store.notifications[0].uid).toBe(survivorUid);
      expect(store.notifications[0].message).toBe('b');
   });

   it('removeNotification is a no-op when the uid does not exist', () => {
      const store = useNotificationsStore();
      store.addNotification({ status: 'info', message: 'a' });
      store.removeNotification('N:DOES-NOT-EXIST');
      expect(store.notifications).toHaveLength(1);
   });
});
