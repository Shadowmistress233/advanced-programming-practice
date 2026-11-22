<script setup>
import { computed } from 'vue'
const props = defineProps({ page: { type: Number, required: true }, total: { type: Number, required: true } })
const emit = defineEmits(['update:page'])
const visible = computed(() => {
  const pages = [1, props.page - 1, props.page, props.page + 1, props.total]
  return [...new Set(pages.filter((n) => n > 0 && n <= props.total))].sort((a, b) => a - b)
})
</script>
<template>
  <nav class="pager" aria-label="分页">
    <button :disabled="page <= 1" aria-label="上一页" @click="emit('update:page', page - 1)">‹</button>
    <button
      v-for="n in visible"
      :key="n"
      :class="{ primary: n === page }"
      :aria-current="page === n ? 'page' : undefined"
      @click="emit('update:page', n)"
    >
      {{ n }}
    </button>
    <button :disabled="page >= total" aria-label="下一页" @click="emit('update:page', page + 1)">›</button>
  </nav>
</template>
