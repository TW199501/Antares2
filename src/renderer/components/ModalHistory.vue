<template>
   <Dialog :open="true" @update:open="(v) => { if (!v) closeModal(); }">
      <DialogContent
         class="!max-w-[760px] max-h-[85vh] !p-0 !gap-0 flex flex-col [&>button.absolute]:!hidden"
         @escape-key-down.prevent="closeModal"
         @pointer-down-outside.prevent="closeModal"
         @interact-outside.prevent
      >
         <DialogHeader class="flex flex-row items-center justify-between !space-y-0 px-5 py-3 border-b border-border/60 bg-muted/30">
            <DialogTitle class="!text-[15px] !font-semibold flex items-center gap-1.5">
               <BaseIcon icon-name="mdiHistory" :size="20" />
               <span class="cut-text">{{ t('general.history') }}: {{ connectionName }}</span>
            </DialogTitle>
            <DialogDescription class="sr-only">
               {{ t('general.history') }} — {{ connectionName }}
            </DialogDescription>
            <Button
               variant="ghost"
               size="icon"
               class="!h-7 !w-7"
               @click.stop="closeModal"
            >
               <BaseIcon icon-name="mdiClose" :size="16" />
            </Button>
         </DialogHeader>

         <!-- Search bar (hidden when no history yet) -->
         <div
            v-if="history.length"
            ref="searchForm"
            class="relative px-5 py-3 border-b border-border/60"
         >
            <Input
               v-model="searchTerm"
               type="text"
               class="pr-9"
               :placeholder="t('database.searchForQueries')"
            />
            <BaseIcon
               v-if="!searchTerm"
               icon-name="mdiMagnify"
               class="absolute right-7 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
               :size="18"
            />
            <BaseIcon
               v-else
               icon-name="mdiBackspace"
               class="absolute right-7 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
               :size="18"
               @click="searchTerm = ''"
            />
         </div>

         <!--
            Body: virtual-scrolled list of past queries when populated, or an
            empty-state placeholder otherwise. The vscroll wrapper preserves
            the BaseVirtualScroll contract — its parent (the modal body) needs
            an explicit pixel height so item-height × visible-count math holds.
         -->
         <div
            v-if="history.length"
            ref="tableWrapper"
            class="vscroll px-2 flex-1 min-h-0"
            :style="{ height: resultsSize + 'px' }"
         >
            <div ref="table">
               <BaseVirtualScroll
                  ref="resultTable"
                  :items="filteredHistory"
                  :item-height="66"
                  :visible-height="resultsSize"
                  :scroll-element="scrollElement"
               >
                  <template #default="{ items }">
                     <div
                        v-for="query in items"
                        :key="query.uid"
                        class="group flex items-center gap-2 my-1 px-2 py-2 rounded-md hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        tabindex="0"
                     >
                        <BaseIcon
                           icon-name="mdiCodeTags"
                           class="shrink-0 text-muted-foreground"
                           :size="20"
                        />
                        <div class="flex-1 min-w-0">
                           <div>
                              <code
                                 class="block truncate text-[13px] font-semibold opacity-80"
                                 :title="query.sql"
                                 v-html="highlight(query.sql, {html: true})"
                              />
                           </div>
                           <div class="flex items-center justify-between mt-0.5">
                              <small class="text-[11px] text-muted-foreground opacity-80">
                                 {{ query.schema }} · {{ formatDate(query.date) }}
                              </small>
                              <div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                                 <Button
                                    variant="ghost"
                                    size="sm"
                                    class="!h-6 !px-1.5 !text-[11px]"
                                    @click.stop="$emit('select-query', query.sql)"
                                 >
                                    <BaseIcon
                                       icon-name="mdiOpenInApp"
                                       class="mr-1"
                                       :size="14"
                                    />
                                    {{ t('general.select') }}
                                 </Button>
                                 <Button
                                    variant="ghost"
                                    size="sm"
                                    class="!h-6 !px-1.5 !text-[11px]"
                                    @click="copyQuery(query.sql)"
                                 >
                                    <BaseIcon
                                       icon-name="mdiContentCopy"
                                       class="mr-1"
                                       :size="14"
                                    />
                                    {{ t('general.copy') }}
                                 </Button>
                                 <Button
                                    variant="ghost"
                                    size="sm"
                                    class="!h-6 !px-1.5 !text-[11px] hover:!text-destructive"
                                    @click="deleteQuery(query)"
                                 >
                                    <BaseIcon
                                       icon-name="mdiDeleteForever"
                                       class="mr-1"
                                       :size="14"
                                    />
                                    {{ t('general.delete') }}
                                 </Button>
                              </div>
                           </div>
                        </div>
                     </div>
                  </template>
               </BaseVirtualScroll>
            </div>
         </div>

         <!-- Empty state when no history yet -->
         <div v-else class="flex flex-col items-center justify-center py-12 px-5 text-center">
            <BaseIcon
               icon-name="mdiHistory"
               class="text-muted-foreground mb-2"
               :size="48"
            />
            <p class="text-sm font-medium text-muted-foreground">
               {{ t('database.thereAreNoQueriesYet') }}
            </p>
         </div>
      </DialogContent>
   </Dialog>
</template>

<script setup lang="ts">
import { ConnectionParams } from 'common/interfaces/antares';
import { highlight } from 'sql-highlight';
import {
   Component,
   computed,
   ComputedRef,
   onBeforeUnmount,
   onMounted,
   onUpdated,
   Prop,
   Ref,
   ref,
   watch
} from 'vue';
import { useI18n } from 'vue-i18n';

import BaseIcon from '@/components/BaseIcon.vue';
import BaseVirtualScroll from '@/components/BaseVirtualScroll.vue';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useFilters } from '@/composables/useFilters';
import { copyText } from '@/libs/copyText';
import { useConnectionsStore } from '@/stores/connections';
import { HistoryRecord, useHistoryStore } from '@/stores/history';

const { t } = useI18n();
const { formatDate } = useFilters();

const { getHistoryByWorkspace, deleteQueryFromHistory } = useHistoryStore();
const { getConnectionName } = useConnectionsStore();

const props = defineProps({
   connection: Object as Prop<ConnectionParams>
});

const emit = defineEmits<{
   'select-query': [sql: string];
   'close': [];
}>();

const table: Ref<HTMLDivElement> = ref(null);
const resultTable: Ref<Component & { updateWindow: () => void }> = ref(null);
const tableWrapper: Ref<HTMLDivElement> = ref(null);
const searchForm: Ref<HTMLDivElement> = ref(null);
const resultsSize = ref(1000);
const scrollElement: Ref<HTMLDivElement> = ref(null);
const searchTermInterval: Ref<NodeJS.Timeout> = ref(null);
const searchTerm = ref('');
const localSearchTerm = ref('');

const connectionName = computed(() => getConnectionName(props.connection.uid));
const history: ComputedRef<HistoryRecord[]> = computed(() => (getHistoryByWorkspace(props.connection.uid) || []));
const filteredHistory = computed(() => history.value.filter(q => q.sql.toLowerCase().search(localSearchTerm.value.toLowerCase()) >= 0));

watch(searchTerm, () => {
   clearTimeout(searchTermInterval.value);

   searchTermInterval.value = setTimeout(() => {
      localSearchTerm.value = searchTerm.value;
   }, 200);
});

const copyQuery = (sql: string) => {
   copyText(sql);
};

const deleteQuery = (query: HistoryRecord[]) => {
   deleteQueryFromHistory({
      workspace: props.connection.uid,
      ...query
   });
};

const resizeResults = () => {
   if (resultTable.value) {
      const el = tableWrapper.value?.parentElement;

      if (el)
         resultsSize.value = el.offsetHeight - (searchForm.value?.offsetHeight || 0);

      resultTable.value.updateWindow();
   }
};

const refreshScroller = () => resizeResults();
const closeModal = () => emit('close');

const onKey = (e: KeyboardEvent) => {
   e.stopPropagation();
   if (e.key === 'Escape')
      closeModal();
};

window.addEventListener('keydown', onKey, { capture: true });

onUpdated(() => {
   if (table.value)
      refreshScroller();

   if (tableWrapper.value)
      scrollElement.value = tableWrapper.value;
});

onMounted(() => {
   resizeResults();
   window.addEventListener('resize', resizeResults);
});

onBeforeUnmount(() => {
   window.removeEventListener('keydown', onKey, { capture: true });
   window.removeEventListener('resize', resizeResults);
   clearInterval(searchTermInterval.value);
});
</script>

<style lang="scss" scoped>
.vscroll {
  overflow: auto;
  overflow-anchor: none;
}
</style>
