import { uidGen } from 'common/libs/uidGen';
import { defineStore } from 'pinia';
import { toast } from 'vue-sonner';

import { useConsoleStore } from './console';

export interface Notification {
   uid: string;
   status: string;
   message: string;
}

type ToastFn = (msg: string, opts?: Record<string, unknown>) => void;

const dispatchToast = (status: string, message: string) => {
   const candidate = (toast as unknown as Record<string, ToastFn>)[status];
   const fn: ToastFn = typeof candidate === 'function'
      ? candidate
      : (toast as unknown as ToastFn);
   fn(message);
};

export const useNotificationsStore = defineStore('notifications', {
   state: () => ({
      // History buffer kept for any consumer that wants to inspect past
      // notifications (e.g. future "notification center"). The visual
      // rendering itself is handled by <Sonner /> mounted in App.vue.
      notifications: [] as Notification[]
   }),
   actions: {
      addNotification (payload: { status: string; message: string }) {
         const notification: Notification = { uid: uidGen('N'), ...payload };
         this.notifications.unshift(notification);

         dispatchToast(notification.status, notification.message);

         useConsoleStore().putLog('debug', {
            level: notification.status,
            process: 'renderer',
            message: notification.message,
            date: new Date()
         });
      },
      removeNotification (uid: string) {
         this.notifications = (this.notifications as Notification[]).filter(item => item.uid !== uid);
      }
   }
});
