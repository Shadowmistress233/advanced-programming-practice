<script setup>
import { ref, watch } from 'vue'
import { get, post, file, useLoad, useAction, user, pageOf, orderStates } from '../api'
import { useRoute } from 'vue-router'
import LoadState from '../components/LoadState.vue'
import { notify } from '../feedback'
import Pager from '../components/Pager.vue'
import { onUnmounted } from 'vue'
const id = useRoute().params.id,
  page = ref(1),
  roleType = ref('from'),
  orderStatus = ref('')
watch([roleType, orderStatus], () => (page.value = 1))
const state = useLoad(
  () =>
    id
      ? get('/orders/' + id)
      : get('/orders/mine', {
          roleType: roleType.value,
          orderStatus: orderStatus.value,
          page: page.value,
          pageSize: 12,
        }),
  [page, roleType, orderStatus],
)
const { busy, issue, run } = useAction(),
  reason = ref(''),
  code = ref(''),
  score = ref(5),
  content = ref(''),
  tags = ref(''),
  submitted = ref(false),
  qr = ref('')
onUnmounted(() => URL.revokeObjectURL(qr.value))
function act(op, body) {
  run(async () => {
    await post('/orders/' + id + '/' + op, body)
    await state.reload()
    notify('流转单已更新')
  })
}
function showCode() {
  run(async () => {
    const blob = await file('/orders/' + id + '/qrcode')
    URL.revokeObjectURL(qr.value)
    qr.value = URL.createObjectURL(blob)
  })
}
function review() {
  run(async () => {
    await post('/reviews', {
      orderId: Number(id),
      score: Number(score.value),
      content: content.value,
      tags: tags.value,
    })
    submitted.value = true
    notify('评价已提交')
    await state.reload()
  })
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title">
      <h1>{{ id ? '流转单详情' : '我的流转' }}</h1>
    </header>
    <div class="toolbar" v-if="!id">
      <label class="field">
        <span>我的身份</span>
        <select v-model="roleType">
          <option value="from">我发起的</option>
          <option value="to">我收到的</option>
        </select>
      </label>
      <label class="field">
        <span>当前状态</span>
        <select v-model="orderStatus">
          <option value="">全部</option>
          <option v-for="(s, i) in orderStates" :value="i">{{ s }}</option>
        </select>
      </label>
    </div>
    <LoadState :state="state" v-slot="{ data }">
      <template v-if="!id">
        <RouterLink class="ledger-row" v-for="o in data.list" :to="'/order/' + (o.orderId ?? o.id)">
          <b>{{ o.itemTitle || o.orderNo }}</b>
          <span>{{ o.orderNo }} · {{ orderStates[o.orderStatus] }} →</span>
        </RouterLink>
        <p v-if="!data.list.length" class="empty">暂无流转单</p>
        <Pager v-if="pageOf(data)?.pages > 1" v-model:page="page" :total="pageOf(data).pages" />
      </template>
      <section v-else class="panel editor">
        <small>{{ data.orderNo }}</small>
        <h2>{{ data.itemTitle || data.item?.title }} · {{ orderStates[data.orderStatus] }}</h2>
        <p>{{ [data.appointTime, data.appointPlace, data.closeReason].filter(Boolean).join(' · ') }}</p>
        <button
          v-if="data.orderStatus === 0 && data.toUserId === user?.userId"
          class="primary"
          :disabled="busy"
          @click="act('confirm', {})"
        >
          确认接单
        </button>
        <RouterLink v-if="data.orderStatus === 1" class="btn primary" :to="'/appointment/' + id">
          预约面交
        </RouterLink>
        <form
          class="toolbar"
          v-if="[0, 1, 2].includes(data.orderStatus)"
          @submit.prevent="act('cancel', { closeReason: reason })"
        >
          <input
            v-model.trim="reason"
            placeholder="取消原因"
            aria-label="取消原因"
            required
            maxlength="255"
          />
          <button :disabled="busy">取消流转</button>
        </form>
        <template v-if="data.orderStatus === 2">
          <button v-if="data.toUserId === user?.userId" :disabled="busy" @click="showCode">
            出示核销二维码
          </button>
          <img v-if="qr && data.toUserId === user?.userId" :src="qr" width="200" alt="核销二维码" />
          <form
            v-if="data.fromUserId === user?.userId"
            class="editor"
            @submit.prevent="act('verify', { verifyCode: code })"
          >
            <label>
              当面验货后输入核销码
              <input v-model.trim="code" required />
            </label>
            <button class="primary" :disabled="busy">确认核销</button>
          </form>
        </template>
        <form
          v-if="data.orderStatus === 3 && !data.reviewed && !submitted"
          class="editor"
          @submit.prevent="review"
        >
          <h3>履约评价</h3>
          <label class="field">
            <span>评分（1～5）</span>
            <input v-model="score" type="number" min="1" max="5" required />
          </label>
          <label class="field">
            <span>评价</span>
            <input v-model="content" maxlength="500" required />
          </label>
          <label class="field">
            <span>标签（逗号分隔）</span>
            <input v-model="tags" />
          </label>
          <button class="primary" :disabled="busy">提交评价</button>
        </form>
      </section>
    </LoadState>
    <p v-if="issue" role="alert" class="error">{{ issue }}</p>
  </main>
</template>
