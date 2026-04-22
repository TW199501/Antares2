<template>
   <div class="flex h-full items-center justify-center border-b border-border bg-muted/30 text-[13px] text-muted-foreground">
      {{ t('application.queryAreaPlaceholder') }}
   </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>
