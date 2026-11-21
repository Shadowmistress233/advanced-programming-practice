<script setup>
import { ref, watch } from 'vue'
import { get, post, useLoad, useAction, unread, pageOf } from '../api'
import LoadState from '../components/LoadState.vue'
import Pager from '../components/Pager.vue'
const notifyType = ref(''),
  isRead = ref(''),
  page = ref(1)
watch([notifyType, isRead], () => (page.value = 1))
const state = useLoad(
  () =>
    get('/messages', { notifyType: notifyType.value, isRead: isRead.value, page: page.value, pageSize: 12 }),
  [notifyType, isRead, page],
)
const { busy, issue, run } = useAction()
function read(id) {
  run(async () => {
    const data = await post('/messages/read', id ? { notifyId: id, all: false } : { all: true })
    unread.value = data.unreadCount
    await state.reload()
  })
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title"><h1>通知收件箱</h1></header>
    <div class="toolbar">
      <label class="field">
        <span>通知类型</span>
        <select v-model="notifyType">
          <option value="">全部</option>
          <option value="order">流转</option>
          <option value="audit">审核</option>
          <option value="credit">积分</option>
          <option value="system">系统</option>
        </select>
      </label>
      <label class="field">
        <span>阅读状态</span>
        <select v-model="isRead">
          <option value="0">未读</option>
          <option value="1">已读</option>
          <option value="">全部</option>
        </select>
      </label>
      <button :disabled="busy" @click="read()">全部标为已读</button>
    </div>
    <p v-if="issue" role="alert" class="error">{{ issue }}</p>
    <LoadState :state="state" v-slot="{ data }">
      <article class="ledger-row" v-for="n in data.list">
        <div>
          <small>{{ n.createTime }}</small>
          <h3>{{ n.title }}</h3>
          <p>{{ n.content }}</p>
        </div>
        <button v-if="!n.isRead" :disabled="busy" @click="read(n.notifyId ?? n.id)">标为已读</button>
        <small v-else>已读</small>
        <RouterLink v-if="n.notifyType === 'order' && n.refId" :to="'/order/' + n.refId">
          查看流转单
        </RouterLink>
      </article>
      <p v-if="!data.list?.length" class="empty">暂无通知</p>
      <Pager v-if="pageOf(data)?.pages > 1" v-model:page="page" :total="pageOf(data).pages" />
    </LoadState>
  </main>
</template>
