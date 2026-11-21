<script setup>
import { ref, watch } from 'vue'
import { get, post, useLoad, useAction, user, pageOf } from '../api'
import LoadState from '../components/LoadState.vue'
import { notify } from '../feedback'
import Pager from '../components/Pager.vue'
const tab = ref('logs'),
  page = ref(1),
  selected = ref(null),
  reason = ref('')
watch(tab, () => (page.value = 1))
const state = useLoad(
  () =>
    tab.value === 'logs'
      ? get('/credits/logs', { page: page.value, pageSize: 12 })
      : get('/reviews', { userId: user.value.userId, page: page.value, pageSize: 12 }),
  [tab, page],
)
const { busy, issue, run } = useAction()
function appeal() {
  run(async () => {
    await post('/credits/appeals', { creditLogId: selected.value, reason: reason.value })
    selected.value = null
    reason.value = ''
    await state.reload()
    notify('申诉已提交')
  })
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title"><h1>信用档案</h1></header>
    <div class="toolbar">
      <label class="field">
        <span>查看记录</span>
        <select v-model="tab">
          <option value="logs">积分流水</option>
          <option value="reviews">收到的评价</option>
        </select>
      </label>
    </div>
    <LoadState :state="state" v-slot="{ data }">
      <h2 v-if="tab === 'logs'">信用 {{ data.creditScore }} · {{ data.level }}</h2>
      <article v-for="r in pageOf(data)?.list" class="ledger-row">
        <div>
          <small>{{ r.createTime }}</small>
          <h3>{{ tab === 'logs' ? r.changeValue + ' 分' : r.score + ' 星' }}</h3>
          <p>{{ r.remark || r.content || r.reasonType }}</p>
        </div>
        <button
          v-if="tab === 'logs' && r.changeValue < 0 && r.appealStatus == null"
          @click="selected = r.creditLogId ?? r.id"
        >
          申诉
        </button>
      </article>
      <p v-if="!pageOf(data)?.list?.length" class="empty">暂无记录</p>
      <Pager v-if="pageOf(data)?.pages > 1" v-model:page="page" :total="pageOf(data).pages" />
    </LoadState>
    <form v-if="selected" class="panel editor" @submit.prevent="appeal">
      <label class="field">
        <span>申诉理由</span>
        <input v-model="reason" required maxlength="500" />
      </label>
      <button class="primary" :disabled="busy">提交申诉</button>
    </form>
    <p v-if="issue" role="alert" class="error">{{ issue }}</p>
  </main>
</template>
