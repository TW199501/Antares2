<template>
   <Dialog :open="true" @update:open="(v) => { if (!v) closeModal(); }">
      <!--
         shadcn Dialog 的 DialogContent 內建一顆 top-4/right-4 絕對定位的關閉 X，
         但它沒辦法跟 header 垂直置中。用 [&>button.absolute]:!hidden
         把它藏起來，我們在 DialogHeader 內自己放一顆用 flex items-center
         對齊的關閉按鈕，跟 DialogTitle 共用同一個 flex row 的垂直軸線。

         spectre.css 在 html root 設 font-size:20px，Tailwind rem 全部被 ×1.25；
         DialogContent 下還嵌著 BaseSelect (footer 的 locale 已移除，但 <h2> 的
         spectre 預設 margin-bottom:7px 仍在)，所以 DialogTitle 用 !m-0 + leading-none
         清掉 spectre 遺產後才能真的垂直置中。
      -->
      <DialogContent
         class="flex max-h-[85vh] max-w-[800px] flex-col gap-0 !p-0 !text-sm [&>button.absolute]:!hidden"
         @escape-key-down.prevent="closeModal"
         @pointer-down-outside.prevent
         @interact-outside.prevent
      >
         <DialogHeader class="relative flex flex-shrink-0 flex-row items-center justify-between gap-2 rounded-t-lg border-b bg-muted/50 px-6 py-3">
            <DialogTitle class="flex items-center gap-1 !m-0 !text-sm leading-none">
               <BaseIcon icon-name="mdiPlaylistPlus" :size="18" />
               <span class="cut-text">{{ t('database.insertRow', 1) }}</span>
            </DialogTitle>
            <!--
               Reka UI (Radix Vue port) warns via console if DialogContent
               has no DialogDescription. `sr-only` keeps it invisible but
               readable by assistive tech so aria-describedby resolves.
            -->
            <DialogDescription class="sr-only">
               {{ t('database.insertRow', 1) }} — {{ props.table }}
            </DialogDescription>
            <button
               type="button"
               class="flex h-5 w-5 items-center justify-center rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
               :title="t('general.close')"
               @click.stop="closeModal"
            >
               <BaseIcon icon-name="mdiClose" :size="16" />
               <span class="sr-only">{{ t('general.close') }}</span>
            </button>
         </DialogHeader>

         <!--
            Field rows.

            Grid has THREE columns:
              1. label   200px   — field name (EN) + comment (ZH) stacked,
                                   leading red `*` when nullable === false.
              2. input   240px   — ALL inputs identical width; type tag
                                   ("DATETIME (23, 3)") lives INSIDE the input
                                   as an absolute-positioned pointer-events-
                                   none span at right-2.
              3. lookup  1fr     — placeholder for sample-data preview (future).

            The old per-row "include this field" Checkbox column was removed —
            blank inputs are skipped at submit time (insertRows filters out
            undefined / null / ''), so the checkbox was duplicating intent.
            AutoIncrement / OnUpdate columns are now `readonly` with a
            "(auto)" placeholder + muted styling so the user can see WHY they
            shouldn't fill them, instead of having to discover an unchecked
            checkbox.

            Inputs drop spectre `.form-input` (1.8rem=36px height, border-radius 6px,
            padding 5/8) and use shadcn tokens instead, so we don't need `!` wars to
            beat spectre height back down to 32px.

            The scrollable body lives on a solid bg-background so the native
            scrollbar track doesn't let the underlying table's row numbers bleed
            through the (semi-transparent) dialog overlay.
         -->
         <form class="flex min-h-0 flex-1 flex-col gap-[10px] overflow-y-auto bg-background px-6 py-4">
            <fieldset :disabled="isInserting" class="contents">
               <div
                  v-for="field in fields"
                  :key="field.name"
                  class="grid min-h-[32px] grid-cols-[200px_240px_1fr] items-center gap-3"
               >
                  <!--
                     Col 1: Label (EN name + ZH comment stacked).
                     Required fields (nullable === false) get a leading red
                     asterisk so the user knows the DB will reject a blank
                     insert. Nullable fields have no marker and are safe to
                     leave blank — they will be skipped at submit time.
                  -->
                  <Label
                     :for="`faker-${field.name}`"
                     class="flex min-w-0 flex-col gap-0.5 !text-sm font-medium"
                     :title="field.name"
                  >
                     <span class="truncate">
                        <span
                           v-if="field.nullable === false"
                           class="mr-0.5 text-red-500"
                           aria-label="required"
                        >*</span>{{ field.name }}
                     </span>
                     <span
                        v-if="field.comment"
                        class="truncate text-xs font-normal text-muted-foreground"
                     >{{ field.comment }}</span>
                  </Label>

                  <!--
                     Col 2: The input, exactly 240px. A relative wrapper
                     lets us absolute-position the type suffix ("DATETIME
                     (23, 3)") INSIDE the right edge of the input, so every
                     field's metadata sits visually coupled with its own
                     input rather than floating in a separate column.

                     pr-[88px] on the input reserves space so typed text
                     never slides under the suffix. pointer-events-none on
                     the suffix guarantees clicks still reach the <input>.

                     Validation policy:
                       NUMBER (non-BIGINT) → type=number step=1
                       IS_BIGINT           → type=text pattern=-?[0-9]* (JS loses precision > 2^53)
                       BIT                 → type=text pattern=[01]* maxlength=1
                       FLOAT               → type=number step=any
                       DATE                → type=text placeholder=yyyy-MM-dd
                       DATETIME            → type=text placeholder=yyyy-MM-dd HH:mm:ss[.fff]
                       TIME                → type=text placeholder=HH:mm:ss[.fff]
                       BLOB (non-pk)       → BaseUploadInput (file picker, own layout)
                       default (text)      → type=text maxlength=charLength||length

                     DATE/DATETIME/TIME are intentionally text inputs — the
                     native pickers leak Chinese locale placeholders
                     ("yyyy/月/dd --:--:--") that cannot be overridden via
                     CSS or lang="". We trade the native picker popup for
                     consistent ASCII formatting across locales.
                  -->
                  <div class="relative w-full">
                     <input
                        v-if="inputKind(field) === 'number-int'"
                        :id="`faker-${field.name}`"
                        v-model="localRow[field.name].value"
                        type="number"
                        step="1"
                        :class="inputClassFor(field)"
                        :readonly="isReadOnly(field)"
                        :placeholder="readOnlyHint(field)"
                     >
                     <input
                        v-else-if="inputKind(field) === 'number-float'"
                        :id="`faker-${field.name}`"
                        v-model="localRow[field.name].value"
                        type="number"
                        step="any"
                        :class="inputClassFor(field)"
                        :readonly="isReadOnly(field)"
                        :placeholder="readOnlyHint(field)"
                     >
                     <input
                        v-else-if="inputKind(field) === 'bigint'"
                        :id="`faker-${field.name}`"
                        v-model="localRow[field.name].value"
                        type="text"
                        inputmode="numeric"
                        pattern="-?[0-9]*"
                        :class="inputClassFor(field)"
                        :readonly="isReadOnly(field)"
                        :placeholder="readOnlyHint(field)"
                     >
                     <input
                        v-else-if="inputKind(field) === 'bit'"
                        :id="`faker-${field.name}`"
                        v-model="localRow[field.name].value"
                        type="text"
                        inputmode="numeric"
                        pattern="[01]*"
                        maxlength="1"
                        :class="inputClassFor(field)"
                        :readonly="isReadOnly(field)"
                        :placeholder="readOnlyHint(field)"
                     >
                     <input
                        v-else-if="inputKind(field) === 'date'"
                        :id="`faker-${field.name}`"
                        v-model="localRow[field.name].value"
                        type="text"
                        inputmode="numeric"
                        :placeholder="readOnlyHint(field) || 'yyyy-MM-dd'"
                        pattern="\d{4}-\d{2}-\d{2}"
                        :class="inputClassFor(field)"
                        :readonly="isReadOnly(field)"
                     >
                     <input
                        v-else-if="inputKind(field) === 'datetime'"
                        :id="`faker-${field.name}`"
                        v-model="localRow[field.name].value"
                        type="text"
                        :placeholder="readOnlyHint(field) || datetimePlaceholder(field)"
                        :class="inputClassFor(field)"
                        :readonly="isReadOnly(field)"
                     >
                     <input
                        v-else-if="inputKind(field) === 'time'"
                        :id="`faker-${field.name}`"
                        v-model="localRow[field.name].value"
                        type="text"
                        :placeholder="readOnlyHint(field) || timePlaceholder(field)"
                        :class="inputClassFor(field)"
                        :readonly="isReadOnly(field)"
                     >
                     <div v-else-if="inputKind(field) === 'blob'" class="w-full">
                        <BaseUploadInput
                           :model-value="localRow[field.name].value"
                           :message="t('general.browse')"
                           @clear="localRow[field.name].value = ''"
                           @select="(path: string) => localRow[field.name].value = path"
                        />
                     </div>
                     <input
                        v-else
                        :id="`faker-${field.name}`"
                        v-model="localRow[field.name].value"
                        type="text"
                        :maxlength="textMaxLength(field)"
                        :class="inputClassFor(field)"
                        :readonly="isReadOnly(field)"
                        :placeholder="readOnlyHint(field)"
                     >

                     <!-- Inline type suffix — lives inside the input's pr-[88px] zone -->
                     <span
                        v-if="inputKind(field) !== 'blob'"
                        class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px]"
                        :class="typeClass(field.type)"
                     >
                        {{ field.type }}{{ wrapNumber(fieldLength(field)) }}
                     </span>
                  </div>

                  <!--
                     Col 3: Sample-data preview placeholder.
                     Future feature: fetch one existing row from the target
                     table and render the corresponding column value here so
                     the user has a concrete example of what to type.
                  -->
                  <div class="min-w-0 truncate text-xs text-muted-foreground" />
               </div>
            </fieldset>
         </form>

         <!--
            Footer button palette is deliberately two-tone:
              - Insert → variant="default" → bg-primary (brand orange #FF5000, white text)
              - Close  → variant="outline" → transparent bg + visible border
            "link" variant was rejected because its primary-colored text read as
            the same hue as the Insert button on muted footer bg. Outline gives
            a clear filled-vs-hollow contrast so "確定/取消" aren't confusable.
         -->
         <DialogFooter class="flex flex-shrink-0 items-center !justify-end gap-2 rounded-b-lg border-t bg-muted/30 px-6 py-3">
            <Button
               variant="default"
               :disabled="isInserting"
               class="h-[32px] !text-sm"
               @click.stop="insertRows"
            >
               {{ t('general.insert') }}
            </Button>
            <Button
               variant="outline"
               class="h-[32px] !text-sm"
               @click.stop="closeModal"
            >
               {{ t('general.close') }}
            </Button>
         </DialogFooter>
      </DialogContent>
   </Dialog>
</template>

<script setup lang="ts">
import { BIT, BLOB, DATE, DATETIME, FLOAT, IS_BIGINT, LONG_TEXT, NUMBER, TEXT, TIME } from 'common/fieldTypes';
import { TableField, TableForeign } from 'common/interfaces/antares';
import moment from 'moment';
import { storeToRefs } from 'pinia';
import { onBeforeUnmount, onMounted, Prop, Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import BaseUploadInput from '@/components/BaseUploadInput.vue';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useFilters } from '@/composables/useFilters';
import Tables from '@/ipc-api/Tables';
import { useNotificationsStore } from '@/stores/notifications';
import { useWorkspacesStore } from '@/stores/workspaces';

const { t } = useI18n();

const { wrapNumber } = useFilters();

const props = defineProps({
   tabUid: [String, Number],
   schema: String,
   table: String,
   fields: Array as Prop<TableField[]>,
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   rowToDuplicate: Object as Prop<any>,
   keyUsage: Array as Prop<TableForeign[]>
});

const emit = defineEmits<{
   'reload': [];
   'hide': [];
}>();

const { addNotification } = useNotificationsStore();
const workspacesStore = useWorkspacesStore();

const { getSelected: selectedWorkspace } = storeToRefs(workspacesStore);

// localRow shape stays { [field]: { group: 'manual', value } } because the
// sidecar's /insertTableFakeRows route checks `row[key].group === 'manual'`
// to decide between raw-value escape and faker generation. We never emit
// any other group since the faker branch is deliberately removed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const localRow: Ref<Record<string, { group: 'manual'; value: any }>> = ref({});
const isInserting = ref(false);

// Shared class for every <input> in the field grid so column 2 stays
// exactly 240px × 32px regardless of HTML5 input type. Explicitly avoids
// the spectre `.form-input` rule set (height:1.8rem=36px, border-radius:
// 6px, padding:0.25rem/0.4rem) which would force us into `!h-[32px]` wars.
//
// pl-2 / pr-[88px]: the right padding reserves room for the absolute-
// positioned type suffix ("DATETIME (23, 3)"). 88px covers the longest
// realistic suffix at text-[11px] ("TIMESTAMP (6)" ≈ 82px); typed content
// never slides under the suffix.
const inputClass =
   'box-border h-[32px] w-full rounded-md border border-input bg-background pl-2 pr-[88px] text-sm text-foreground ' +
   'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ' +
   'read-only:cursor-not-allowed read-only:bg-muted/50 read-only:text-muted-foreground';

// DB-managed timestamp default tokens across all supported clients:
//   MSSQL: getdate(), sysdatetime(), sysutcdatetime(), current_timestamp
//   PG:    now(), current_timestamp, transaction_timestamp(), localtimestamp
//   MySQL: current_timestamp, now()
//   SQLite: current_timestamp, current_date, current_time
// INFORMATION_SCHEMA wraps MSSQL defaults in parens like "(getdate())", so
// we substring-match (lowercased) instead of equality-match.
const DB_MANAGED_DEFAULT_TOKENS = [
   'current_timestamp',
   'getdate',
   'sysdatetime',
   'sysutcdatetime',
   'now()',
   'transaction_timestamp',
   'localtimestamp',
   'current_date',
   'current_time'
];

const hasDbManagedDefault = (field: TableField): boolean => {
   if (!field.default) return false;
   const d = String(field.default).toLowerCase();
   return DB_MANAGED_DEFAULT_TOKENS.some(tok => d.includes(tok));
};

// AutoIncrement / OnUpdate / DB-managed-timestamp fields are filled by the
// engine — the user shouldn't fill them. Kept as readonly (not disabled)
// so they stay in tab order and their "(auto)" placeholder + muted
// background communicate the reason. Submit-time skip handles the rest:
// the value stays null and the undefined|null|'' filter in insertRows
// drops them before sending.
const isReadOnly = (field: TableField): boolean =>
   !!field.autoIncrement || !!field.onUpdate || hasDbManagedDefault(field);

const readOnlyHint = (field: TableField): string => {
   if (!isReadOnly(field)) return '';
   if (field.autoIncrement) return '(auto-increment)';
   if (field.onUpdate) return '(on update)';
   return '(db default)';
};

// Same base classes either way; readonly variants come from the
// `read-only:` Tailwind variants baked into inputClass above.
const inputClassFor = (_field: TableField): string => inputClass;

const typeClass = (type: string) => {
   if (type)
      return `type-${type.toLowerCase().replaceAll(' ', '_').replaceAll('"', '')}`;
   return '';
};

// Classify a field into an input widget family. Keeps the template's
// v-if/v-else-if chain readable and lets us unit-test the mapping in
// isolation if needed later.
type InputKind = 'number-int' | 'number-float' | 'bigint' | 'bit' | 'date' | 'datetime' | 'time' | 'blob' | 'text';
const inputKind = (field: TableField): InputKind => {
   const type = field.type;
   if (IS_BIGINT.includes(type)) return 'bigint';
   if (NUMBER.includes(type)) return 'number-int';
   if (FLOAT.includes(type)) return 'number-float';
   if (BIT.includes(type)) return 'bit';
   if (DATE.includes(type)) return 'date';
   if (DATETIME.includes(type)) return 'datetime';
   if (TIME.includes(type)) return 'time';
   if (BLOB.includes(type) && field.key !== 'pri') return 'blob';
   return 'text';
};

// Max length for text inputs. charLength is PG/MySQL's CHAR_MAX_LENGTH
// (byte-accurate) and length is the raw declared length. Fall back to
// undefined (unbounded) for LONG_TEXT/JSON.
const textMaxLength = (field: TableField): number | undefined => {
   if (LONG_TEXT.includes(field.type)) return undefined;
   if (TEXT.includes(field.type)) {
      const n = Number(field.charLength);
      return Number.isFinite(n) && n > 0 ? n : undefined;
   }
   const n = Number(field.length);
   return Number.isFinite(n) && n > 0 ? n : undefined;
};

// Placeholder strings for the text-based date/datetime/time inputs.
// We DON'T use type="datetime-local" because Chromium renders a locale-
// sensitive placeholder ("yyyy/月/dd --:-- --" on zh-TW) that cannot be
// overridden by CSS, `lang`, or an HTML placeholder attribute. Going back
// to type="text" lets us force ASCII formatting across locales.
//
// The fractional-seconds section (.fff / .f / .fffffff) is driven by
// field.datePrecision so MSSQL DATETIME2(3) renders "yyyy-MM-dd HH:mm:ss.fff"
// while plain DATETIME renders "yyyy-MM-dd HH:mm:ss".
const datetimePlaceholder = (field: TableField): string => {
   const p = Number(field.datePrecision ?? 0);
   return p > 0 ? `yyyy-MM-dd HH:mm:ss.${'f'.repeat(p)}` : 'yyyy-MM-dd HH:mm:ss';
};

const timePlaceholder = (field: TableField): string => {
   const p = Number(field.datePrecision ?? 0);
   return p > 0 ? `HH:mm:ss.${'f'.repeat(p)}` : 'HH:mm:ss';
};

const insertRows = async () => {
   isInserting.value = true;
   const rowToInsert: Record<string, { group: 'manual'; value: unknown }> = {};

   for (const key of Object.keys(localRow.value)) {
      // Value-driven insert: if the user didn't type anything for a field,
      // DON'T send it to the backend — let the DB apply its own default
      // (or reject if the column is NOT NULL, at which point the red `*`
      // marker we already rendered tells the user which field to fill).
      // Covers undefined / null / '' together. AutoIncrement / OnUpdate
      // columns naturally fall through here because their inputs are
      // readonly with no seed value.
      const v = localRow.value[key].value;
      if (v === undefined || v === null || v === '') continue;
      rowToInsert[key] = localRow.value[key];
   }

   const fieldTypes: Record<string, string> = {};
   props.fields.forEach(field => {
      fieldTypes[field.name] = field.type;
   });

   try {
      // Always insert exactly 1 row. Batch insert was removed per user
      // direction — if bulk fake data is needed later it should live in a
      // dedicated tool rather than being muscle-memory on the add-row UI.
      const { status, response } = await Tables.insertTableFakeRows({
         uid: selectedWorkspace.value,
         schema: props.schema,
         table: props.table,
         row: rowToInsert,
         repeat: 1,
         fields: fieldTypes,
         locale: 'en'
      });

      if (status === 'success') {
         closeModal();
         emit('reload');
      }
      else
         addNotification({ status: 'error', message: response });
   }
   catch (err) {
      addNotification({ status: 'error', message: err.stack });
   }

   isInserting.value = false;
};

const closeModal = () => {
   emit('hide');
};

// Mirrors WorkspaceTabQueryTable.fieldLength AND extends it for temporal
// types so the type-tag we show here matches what the user asked for:
//
//   BIGINT           → (19)
//   DECIMAL(10,2)    → (10, 2)
//   VARCHAR(50)      → (50)
//   BIT              → (1)   ← BIT without explicit length is 1 bit
//   DATE             → (10)  ← "YYYY-MM-DD"
//   DATETIME2(3)     → (23, 3) ← ISO-string width 23, fractional digits 3
//   DATETIME         → (19)
//   TIME(6)          → (15, 6) ← "HH:MM:SS.ffffff" = 15 chars, 6 digits
//   BLOB / LONG_TEXT → null (no parens printed)
//
// MSSQL's INFORMATION_SCHEMA.DATETIME_PRECISION gives ONLY the fractional-
// seconds digits (0-7), not the total string width. So for temporal types
// we compute the ISO width ourselves: 19 base chars for datetime, 8 for
// time, plus (1 + P) if the fractional part is non-zero.
const fieldLength = (field: TableField) => {
   if ([...BLOB, ...LONG_TEXT].includes(field.type)) return null;
   if (TEXT.includes(field.type)) return field.charLength;
   if (field.numScale) return `${field.numPrecision}, ${field.numScale}`;
   if (BIT.includes(field.type)) return field.length || 1;
   if (DATE.includes(field.type)) return 10;
   if (DATETIME.includes(field.type)) {
      const p = Number(field.datePrecision ?? 0);
      const len = p > 0 ? 19 + 1 + p : 19;
      return p > 0 ? `${len}, ${p}` : len;
   }
   if (TIME.includes(field.type)) {
      const p = Number(field.datePrecision ?? 0);
      const len = p > 0 ? 8 + 1 + p : 8;
      return p > 0 ? `${len}, ${p}` : len;
   }
   return field.length;
};

const onKey = (e: KeyboardEvent) => {
   e.stopPropagation();
   if (e.key === 'Escape')
      closeModal();
};

window.addEventListener('keydown', onKey);

onMounted(() => {
   // DialogContent handles auto-focus via its own focus-trap; we only need
   // the per-field default value seed logic below. The old manual
   // querySelector('.modal-container .form-input') focus is no longer
   // required and would anyway no longer match anything under shadcn.

   const rowObj: Record<string, { group: 'manual'; value: unknown }> = {};

   if (!props.rowToDuplicate) {
      // Set default values
      for (const field of props.fields) {
         let fieldDefault: unknown;

         if (field.default === 'NULL') fieldDefault = null;
         else {
            if ([...NUMBER, ...FLOAT].includes(field.type))
               fieldDefault = !field.default || Number.isNaN(+field.default.replaceAll('\'', '')) ? null : +field.default.replaceAll('\'', '');
            else if ([...TEXT, ...LONG_TEXT].includes(field.type)) {
               fieldDefault = field.default
                  ? field.default.includes('\'')
                     ? field.default.split('\'')[1]
                     : field.default
                  : '';
            }
            else if ([...TIME, ...DATE].includes(field.type))
               fieldDefault = field.default;
            else if (BIT.includes(field.type))
               fieldDefault = field.default?.replaceAll('\'', '').replaceAll('b', '');
            else if (DATETIME.includes(field.type)) {
               if (field.default && ['current_timestamp', 'now()'].some(term => field.default.toLowerCase().includes(term))) {
                  let datePrecision = '';
                  for (let i = 0; i < field.datePrecision; i++)
                     datePrecision += i === 0 ? '.S' : 'S';
                  fieldDefault = moment().format(`YYYY-MM-DD HH:mm:ss${datePrecision}`);
               }
               else
                  fieldDefault = field.default;
            }
            else
               fieldDefault = field.default;
         }

         // DB-managed fields (auto-increment, on-update, default=getdate()
         // /current_timestamp/etc) stay null so they fall into the
         // skip-on-blank branch in insertRows; the readonly UI prevents
         // the user from accidentally overriding the engine's value.
         if (isReadOnly(field))
            rowObj[field.name] = { group: 'manual', value: null };
         else
            rowObj[field.name] = { group: 'manual', value: fieldDefault };
      }
   }
   else {
      // Set values to duplicate. Same readonly rule applies: when
      // duplicating an existing row, identity / on-update / DB-default
      // columns must NOT be carried over verbatim — the new row should
      // get a fresh PK and a fresh timestamp from the engine.
      for (const field of props.fields) {
         if (isReadOnly(field))
            rowObj[field.name] = { group: 'manual', value: null };
         else if (typeof props.rowToDuplicate[field.name] !== 'object')
            rowObj[field.name] = { group: 'manual', value: props.rowToDuplicate[field.name] };
         else if (field.type === 'JSON')
            rowObj[field.name] = { group: 'manual', value: JSON.stringify(props.rowToDuplicate[field.name]) };
      }
   }

   localRow.value = { ...rowObj };
});

onBeforeUnmount(() => {
   window.removeEventListener('keydown', onKey);
});
</script>

<style scoped>
  .field-type {
    font-size: 12px;
  }
</style>
