<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { user, unread, refreshUnread } from '../api'
const route = useRoute(),
  router = useRouter(),
  search = ref('')
watch(
  () => route.query.keyword,
  (value) => (search.value = value || ''),
  { immediate: true },
)
let timer
watch(
  user,
  (value) => {
    clearInterval(timer)
    if (value) {
      const poll = () => refreshUnread().catch(() => {})
      poll()
      timer = setInterval(poll, 30000)
    }
  },
  { immediate: true },
)
onUnmounted(() => clearInterval(timer))
</script>
<template>
  <header class="topnav">
    <RouterLink to="/home" class="brand">
      <span class="logo">循</span>
      校园循环
    </RouterLink>
    <form
      class="searchbox"
      @submit.prevent="router.push({ path: '/search', query: { keyword: search.trim() } })"
    >
      <button aria-label="搜索"><span class="glass"></span></button>
      <input v-model="search" aria-label="搜索物品" placeholder="找教材、生活用品…" />
    </form>
    <nav aria-label="主导航">
      <RouterLink
        v-for="[url, label] in [
          ['/home', '发现'],
          ['/skills', '技能'],
          ['/market', '集市'],
        ]"
        :key="url"
        :to="url"
        active-class="current"
      >
        {{ label }}
      </RouterLink>
    </nav>
    <div class="nav-user">
      <RouterLink
        v-if="user?.role === 'admin' || user?.role === 'club'"
        :to="user.role === 'admin' ? '/admin' : '/club'"
      >
        工作台
      </RouterLink>
      <RouterLink v-if="user" to="/messages">消息 {{ unread || '' }}</RouterLink>
      <RouterLink :to="user ? '/profile' : '/login'">
        {{ user?.realName || user?.username || '登录' }}
      </RouterLink>
    </div>
  </header>
</template>
