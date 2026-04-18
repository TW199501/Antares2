import { createI18n } from 'vue-i18n';

import enUS from './en-US.json';
import jaJP from './ja-JP.json';
import koKR from './ko-KR.json';
import zhCN from './zh-CN.json';
import zhTW from './zh-TW.json';

const messages = {
   'en-US': enUS,
   'ja-JP': jaJP,
   'zh-CN': zhCN,
   'zh-TW': zhTW,
   'ko-KR': koKR
};

export type MessageSchema = typeof enUS
export type AvailableLocale = keyof typeof messages

const i18n = createI18n<[MessageSchema], AvailableLocale, false>({
   legacy: false,
   fallbackLocale: 'en-US',
   missingWarn: false,
   fallbackWarn: false,
   messages
});

export { i18n };
