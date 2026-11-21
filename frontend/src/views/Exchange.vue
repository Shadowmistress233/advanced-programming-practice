<script setup>
import { ref } from 'vue'
import { get, post, useLoad, useAction } from '../api'
import { useRoute, useRouter } from 'vue-router'
import LoadState from '../components/LoadState.vue'
const id = useRoute().params.id,
  router = useRouter(),
  offer = ref(''),
  message = ref(''),
  page = ref(1)
const state = useLoad(() => get('/items/' + id))
const offers = useLoad(async () => {
  if (!state.data.value || state.data.value.tradeMode !== 'exchange') return { list: [] }
  return get('/items/mine', { status: 1, page: page.value, pageSize: 12 })
}, [state.data, page])
const { busy, issue, run } = useAction()
function changePage(delta) {
  offer.value = ''
  page.value += delta
}
function send() {
  run(async () => {
    const tradeMode = state.data.value.tradeMode
    const order = await post('/orders', {
      itemId: Number(id),
      tradeMode,
      ...(tradeMode === 'exchange' ? { offerItemId: Number(offer.value) } : {}),
      message: message.value,
    })
    router.push('/order/' + order.orderId)
  })
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title"><h1>发起流转</h1></header>
    <LoadState :state="state" v-slot="{ data }">
      <form class="panel editor" @submit.prevent="send">
        <h2>{{ data.title }}</h2>
        <p>
          {{ data.tradeMode === 'exchange' ? '对方想换 · ' + data.expectItem : '寄售价 · ¥' + data.price }}
        </p>
        <template v-if="data.tradeMode === 'exchange'">
          <LoadState :state="offers" v-slot="{ data }">
            <label class="field">
              <span>选择我的在售物品</span>
              <select v-model="offer" required>
                <option value="" disabled>选择换出物品</option>
                <option v-for="v in data.list" :value="v.itemId ?? v.id">{{ v.title }}</option>
              </select>
            </label>
            <div v-if="data.pages > 1" class="actions">
              <button type="button" :disabled="page === 1" @click="changePage(-1)">上一页</button>
              <button type="button" :disabled="page >= data.pages" @click="changePage(1)">下一页</button>
            </div>
          </LoadState>
        </template>
        <label class="field">
          留言
          <textarea v-model="message" maxlength="200" />
        </label>
        <p v-if="issue" role="alert" class="error">{{ issue }}</p>
        <button class="primary" :disabled="busy">提交流转意向</button>
      </form>
    </LoadState>
  </main>
</template>
