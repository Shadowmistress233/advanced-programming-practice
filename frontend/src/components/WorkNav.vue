<script setup>
import {
  BookMarked,
  CalendarDays,
  ClipboardCheck,
  HeartHandshake,
  LayoutDashboard,
  ScrollText,
  Settings,
  ShieldAlert,
} from '@lucide/vue'
import { user } from '../api'

const adminLinks = [
  ['/admin', '运营概览', LayoutDashboard],
  ['/admin/review', '物品审核', ClipboardCheck],
  ['/admin/reports', '工单处理', ShieldAlert],
  ['/admin/dicts', '业务字典', BookMarked],
  ['/admin/logs', '操作日志', ScrollText],
]
</script>
<template>
  <aside class="worknav">
    <RouterLink class="brand" to="/home">
      <span class="logo">循</span>
      校园工作台
    </RouterLink>
    <section v-if="user?.role === 'admin'">
      <small>运营管理</small>
      <RouterLink
        v-for="[url, label, Icon] in adminLinks"
        :to="url"
        :key="url"
        class="side-link"
        exact-active-class="active"
      >
        <component :is="Icon" :size="16" :stroke-width="1.8" />
        <span>{{ label }}</span>
      </RouterLink>
    </section>
    <section>
      <small>社团与活动</small>
      <RouterLink class="side-link" to="/club" active-class="active">
        <HeartHandshake :size="16" :stroke-width="1.8" />
        <span>捐赠审核台</span>
      </RouterLink>
      <RouterLink class="side-link" to="/market">
        <CalendarDays :size="16" :stroke-width="1.8" />
        <span>主题活动</span>
      </RouterLink>
      <RouterLink class="side-link" to="/profile">
        <Settings :size="16" :stroke-width="1.8" />
        <span>账户设置</span>
      </RouterLink>
    </section>
  </aside>
</template>
