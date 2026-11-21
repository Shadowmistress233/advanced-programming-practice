<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { sample } from '../data'
const route = useRoute(),
  router = useRouter(),
  search = ref('')
watch(
  () => route.fullPath,
  () => {
    search.value = route.path === '/search' ? route.query.q || '' : ''
  },
  { immediate: true },
)
const section = computed(() => {
  if (/^\/skill/.test(route.path)) return '/skills'
  if (['/profile', '/credit', '/mine'].includes(route.path)) return '/profile'
  return route.path === '/market' ? '/market' : '/home'
})
</script>
<template>
  <header class="topnav">
    <RouterLink to="/home" class="brand"><span class="logo">循</span>校园循环</RouterLink>
    <nav aria-label="主导航">
      <RouterLink
        v-for="[path, label] in [
          ['/home', '首页'],
          ['/skills', '技能交换'],
          ['/market', '换物集市'],
          ['/profile', '我的'],
        ]"
        :key="path"
        :to="path"
        :class="{ current: section === path }"
        >{{ label }}</RouterLink
      >
    </nav>
    <form
      class="searchbox"
      @submit.prevent="router.push({ path: '/search', query: search.trim() ? { q: search.trim() } : {} })"
    >
      <button aria-label="搜索"><span class="glass"></span></button
      ><input v-model="search" aria-label="搜索闲置物品" placeholder="搜教材、数码、自行车..." />
    </form>
    <div class="nav-user">
      <RouterLink to="/credit">信用分 <strong>96</strong></RouterLink>
      <RouterLink class="mail" to="/messages" aria-label="消息中心"
        >✉<i v-if="[0, 1].some((id) => !sample.noticesRead.includes(id))"></i
      ></RouterLink>
      <RouterLink class="avatar" to="/profile" aria-label="个人中心">张</RouterLink>
    </div>
  </header>
</template>
