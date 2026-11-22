<script setup>
import { ref, watch } from 'vue'
import { ArrowRight, Bell, Check, CheckCheck } from '@lucide/vue'
import { get, post, useLoad, useAction, unread, pageOf } from '../api'
import LoadState from '../components/LoadState.vue'
import Pager from '../components/Pager.vue'
import { notify } from '../feedback'

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
    if (!id) notify('已将全部消息标为已读')
  })
}

const typeTabs = [
  ['', '全部消息', ''],
  ['order', '流转通知', 'mint'],
  ['audit', '审核结果', 'sky'],
  ['credit', '信用变动', 'gold'],
  ['system', '系统公告', 'violet'],
]
const typeLabel = { order: ['流转', 'mint'], audit: ['审核', 'sky'], credit: ['信用', 'gold'], system: ['系统', 'violet'] }
</script>
<template>
  <main class="wrap live">
    <header class="page-title">
      <h1>通知收件箱</h1>
      <small>流转、审核、积分与系统公告按类聚合，顶部红点每 30 秒同步</small>
    </header>
    <div class="spread" style="flex-wrap: wrap">
      <div class="seg-tabs" role="tablist" aria-label="通知类型筛选">
        <button
          v-for="[val, label] in typeTabs"
          :key="val"
          type="button"
          class="seg-tab"
          :class="{ active: notifyType === val }"
          @click="notifyType = val"
        >
          {{ label }}
        </button>
      </div>
      <div class="actions">
        <div class="seg-tabs" role="tablist" aria-label="阅读状态">
          <button type="button" class="seg-tab" :class="{ active: isRead === '' }" @click="isRead = ''">全部</button>
          <button type="button" class="seg-tab" :class="{ active: isRead === '0' }" @click="isRead = '0'">仅未读</button>
          <button type="button" class="seg-tab" :class="{ active: isRead === '1' }" @click="isRead = '1'">已读</button>
        </div>
        <button :disabled="busy" @click="read()">
          <CheckCheck :size="15" :stroke-width="1.8" />
          <span>全部标为已读</span>
        </button>
      </div>
    </div>

    <p v-if="issue" role="alert" class="error">{{ issue }}</p>
    <LoadState :state="state" v-slot="{ data }">
      <div class="stack tight">
        <article
          class="ledger-row msg-row"
          :class="{ unreadRow: !n.isRead }"
          v-for="n in data.list"
          :key="n.notifyId ?? n.id"
        >
          <div class="msg-main">
            <div class="inline" style="margin-bottom: 4px">
              <span v-if="!n.isRead" class="unread-dot" aria-label="未读"></span>
              <span class="tag" :class="typeLabel[n.notifyType]?.[1]">
                {{ typeLabel[n.notifyType]?.[0] || '通知' }}
              </span>
              <small style="margin-bottom: 0">{{ n.createTime }}</small>
            </div>
            <h3>{{ n.title }}</h3>
            <p class="small">{{ n.content }}</p>
          </div>
          <div class="actions msg-actions">
            <RouterLink v-if="n.notifyType === 'order' && n.refId" class="msg-link" :to="'/order/' + n.refId">
              <span>查看流转单</span>
              <ArrowRight :size="14" :stroke-width="1.8" />
            </RouterLink>
            <button v-if="!n.isRead" :disabled="busy" @click="read(n.notifyId ?? n.id)">
              <Check :size="14" :stroke-width="1.8" />
              <span>标为已读</span>
            </button>
            <small v-else class="msg-read-tag">已读</small>
          </div>
        </article>
      </div>
      <div v-if="!data.list?.length" class="empty panel">
        <Bell :size="20" />
        <p>暂无通知</p>
      </div>
      <Pager v-if="pageOf(data)?.pages > 1" v-model:page="page" :total="pageOf(data).pages" />
    </LoadState>
  </main>
</template>

<style scoped>
.msg-row {
  border-radius: 8px;
  border: 1px solid var(--line);
}
.msg-row.unreadRow {
  border-left: 4px solid #303e82;
  background: #ffffff;
}
.unread-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  flex: none;
}
.msg-main {
  flex: 1 1 320px;
  min-width: 0;
}
.msg-actions {
  margin-left: auto;
  justify-content: flex-end;
  gap: 12px;
}
.msg-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--accent);
  font-size: 13.5px;
  font-weight: 600;
}
.msg-read-tag {
  margin-bottom: 0;
  padding: 0 6px;
}
</style>
