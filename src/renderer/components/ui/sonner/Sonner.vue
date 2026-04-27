<!--
  @usage
  // 1. Mount once near app root (Batch 9 task — not in Batch 0)
  <Sonner />

  // 2. Imperatively trigger toasts from anywhere
  import { toast } from '@/components/ui/sonner';
  toast.success('Saved');
  toast.error('Failed', { description: err.message });
  toast.promise(myPromise, { loading: '...', success: 'OK', error: 'Bad' });
-->
<script setup lang="ts">
import 'vue-sonner/style.css';

import { Toaster } from 'vue-sonner';
</script>

<template>
   <Toaster
      position="bottom-right"
      rich-colors
      close-button
      :toast-options="{
         classes: {
            toast: 'bg-card border-border text-card-foreground shadow-lg',
            title: 'text-[14px] font-medium',
            description: 'text-[12px] text-muted-foreground'
         }
      }"
   />
</template>
