import {
   allLocales,
   Faker,
   faker as defaultFaker,
   type LocaleDefinition
} from '@faker-js/faker';
import moment from 'moment';

const fakerByLocale = new Map<string, Faker>();
let active: Faker = defaultFaker;

function setLocale (name: string) {
   if (!name) {
      active = defaultFaker;
      rebuild();
      return;
   }

   if (!fakerByLocale.has(name)) {
      const localeDef = (allLocales as Record<string, LocaleDefinition>)[name];
      if (!localeDef) {
         active = defaultFaker;
         rebuild();
         return;
      }
      fakerByLocale.set(name, new Faker({ locale: [localeDef, allLocales.en] }));
   }

   active = fakerByLocale.get(name)!;
   rebuild();
}

function build () {
   return {
      ...active,
      seed: active.seed.bind(active),
      setLocale,
      date: {
         ...active.date,
         now: () => moment().format('YYYY-MM-DD HH:mm:ss')
      },
      time: {
         now: () => moment().format('HH:mm:ss'),
         random: () => moment(active.date.recent()).format('HH:mm:ss')
      }
   };
}

let _custom = build();
function rebuild () {
   _custom = build();
}

export const fakerCustom = new Proxy({} as ReturnType<typeof build>, {
   get: (_target, key: string | symbol) => (_custom as Record<string | symbol, unknown>)[key as string],
   has: (_target, key: string | symbol) => key in (_custom as Record<string | symbol, unknown>)
});
