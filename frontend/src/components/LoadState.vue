<script setup>
defineProps(['state'])
</script>
<template>
  <p v-if="state.loading.value" role="status" class="empty">正在加载…</p>
  <div v-else-if="state.error.value" role="alert" class="panel notice">
    {{ state.error.value }} <button @click="state.reload">重试</button>
  </div>
  <slot v-else :data="state.data.value" />
</template>
