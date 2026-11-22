<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import TopNav from './components/TopNav.vue'
import WorkNav from './components/WorkNav.vue'
import { dialog, toast, accept } from './feedback'
const route = useRoute()
const work = computed(() => route.path.startsWith('/admin') || route.path === '/club')
const popup = ref()
watch(dialog, async (value) => {
  await nextTick()
  if (value && !popup.value.open) popup.value.showModal()
  else if (!value && popup.value.open) popup.value.close()
})
</script>
<template>
  <div v-if="work" class="workspace">
    <WorkNav />
    <main class="workbody"><RouterView :key="route.path" /></main>
  </div>
  <template v-else><TopNav v-if="route.path !== '/login'" /><RouterView :key="route.path" /></template>
  <dialog ref="popup" @cancel="dialog = null">
    <template v-if="dialog"
      ><h2>{{ dialog.title }}</h2>
      <p class="dialog-copy">{{ dialog.body }}</p>
      <div class="actions end">
        <button v-if="dialog.action" @click="dialog = null">取消</button
        ><button class="primary" autofocus @click="accept">{{ dialog.button || '知道了' }}</button>
      </div>
    </template>
  </dialog>
  <div v-if="toast" class="toast" role="status">{{ toast }}</div>
</template>
