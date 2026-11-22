<script setup>
import { user } from '../api'
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
        v-for="[url, label] in [
          ['/admin', '运营概览'],
          ['/admin/review', '物品审核'],
          ['/admin/reports', '工单处理'],
          ['/admin/dicts', '业务字典'],
          ['/admin/logs', '操作日志'],
        ]"
        :to="url"
        :key="url"
        class="side-link"
        exact-active-class="active"
      >
        {{ label }}
      </RouterLink>
    </section>
    <section>
      <small>社团与活动</small>
      <RouterLink class="side-link" to="/club" active-class="active">捐赠台账</RouterLink>
      <RouterLink class="side-link" to="/market">主题活动</RouterLink>
      <RouterLink class="side-link" to="/profile">账户设置</RouterLink>
    </section>
  </aside>
</template>
