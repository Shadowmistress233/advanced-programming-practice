<script setup>
import { ref } from 'vue'
import { get, post, useLoad, useAction, orderStates } from '../api'
import { useRoute, useRouter } from 'vue-router'
import LoadState from '../components/LoadState.vue'
const id = useRoute().params.id,
  router = useRouter(),
  day = ref(''),
  time = ref(''),
  place = ref('')
const slots = Array.from(
  { length: 25 },
  (_, i) => String(9 + Math.floor(i / 2)).padStart(2, '0') + ':' + (i % 2 ? '30' : '00'),
)
const state = useLoad(() => get('/orders/' + id)),
  { busy, issue, run } = useAction()
function save() {
  run(async () => {
    if (new Date(day.value + 'T' + time.value) <= new Date()) throw new Error('请选择未来时段')
    await post('/orders/' + id + '/appointment', {
      appointTime: day.value + ' ' + time.value + ':00',
      appointPlace: place.value,
    })
    router.push('/order/' + id)
  })
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title"><h1>预约面交</h1></header>
    <LoadState :state="state" v-slot="{ data }">
      <form v-if="data.orderStatus === 1" class="panel editor" @submit.prevent="save">
        <h2>{{ data.orderNo }}</h2>
        <label class="field">
          <span>日期</span>
          <input v-model="day" type="date" required />
        </label>
        <label class="field">
          <span>时段</span>
          <select v-model="time" required>
            <option v-for="t in slots">{{ t }}</option>
          </select>
        </label>
        <label class="field">
          <span>校内自提点</span>
          <select v-model="place" required>
            <option v-for="p in ['本部图书馆南门（有监控）', '三舍楼下服务点', '二食堂门口']">{{ p }}</option>
          </select>
        </label>
        <p v-if="issue" role="alert" class="error">{{ issue }}</p>
        <button class="primary" :disabled="busy">确认预约</button>
      </form>
      <p v-else class="panel">当前状态为{{ orderStates[data.orderStatus] }}，无法预约。</p>
    </LoadState>
  </main>
</template>
