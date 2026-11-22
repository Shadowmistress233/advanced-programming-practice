<script setup>
import { ref, watch, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bell, Compass, LayoutGrid, Package, PlusCircle, Search, ShieldCheck, Sparkles, Store } from '@lucide/vue'
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

const navItems = computed(() => {
  const base = [
    ['/home', '发现', Compass],
    ['/skills', '技能', Sparkles],
    ['/market', '集市', Store],
  ]
  if (user.value) {
    base.push(['/publish', '发布', PlusCircle], ['/mine', '我的', Package])
  }
  return base
})
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
      <button aria-label="搜索"><Search :size="15" :stroke-width="1.8" color="#787d8b" /></button>
      <input v-model="search" aria-label="搜索物品" placeholder="找教材、生活用品…" />
    </form>
    <nav aria-label="主导航">
      <RouterLink
        v-for="[url, label, Icon] in navItems"
        :key="url"
        :to="url"
        active-class="current"
      >
        <component :is="Icon" :size="15" :stroke-width="1.8" />
        <span>{{ label }}</span>
      </RouterLink>
    </nav>
    <div class="nav-user">
      <RouterLink
        v-if="user?.role === 'admin' || user?.role === 'club'"
        :to="user.role === 'admin' ? '/admin' : '/club'"
        class="nav-pill"
      >
        <LayoutGrid :size="14" :stroke-width="1.8" />
        <span>工作台</span>
      </RouterLink>
      <RouterLink v-if="user" to="/credit" class="nav-credit" title="查看我的信用档案">
        <ShieldCheck :size="14" :stroke-width="1.9" />
        <span>信用 {{ user.creditScore }}</span>
      </RouterLink>
      <RouterLink v-if="user" to="/messages" class="nav-msg">
        <Bell :size="15" :stroke-width="1.8" />
        <span>消息</span>
        <span v-if="unread > 0" class="unread-badge">{{ unread > 99 ? '99+' : unread }}</span>
      </RouterLink>
      <RouterLink :to="user ? '/profile' : '/login'" class="nav-profile">
        <span v-if="user" class="nav-avatar">{{ (user.realName || user.username || '我')[0] }}</span>
        <span>{{ user?.realName || user?.username || '登录' }}</span>
      </RouterLink>
    </div>
  </header>
</template>

<style scoped>
.nav-credit {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 99px;
  background: #e6f6f0;
  color: #0f8a6a;
  font-size: 12.5px;
  font-weight: 600;
}
.nav-credit:hover {
  background: #d5efe5;
  color: #0c7459;
}
.nav-pill {
  padding: 4px 10px;
  border-radius: 99px;
  background: #edf2ff;
  color: #303e82;
  font-size: 12.5px;
  font-weight: 600;
}
.nav-msg {
  position: relative;
}
.unread-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 17px;
  height: 17px;
  padding: 0 5px;
  border-radius: 99px;
  background: #ef4444;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}
.nav-profile {
  gap: 7px;
  font-weight: 600;
}
.nav-avatar {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #303e82;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
}
</style>
