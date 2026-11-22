<script setup>
import { computed, ref } from 'vue'
import { Calendar, Clock, MapPin, ShieldCheck } from '@lucide/vue'
import { get, post, useLoad, useAction, orderStates, pickupPoints } from '../api'
import { useRoute, useRouter } from 'vue-router'
import LoadState from '../components/LoadState.vue'
import { confirmAction, notify } from '../feedback'

const id = useRoute().params.id,
  router = useRouter()

const now = new Date()
const todayStr = now.toISOString().slice(0, 10)
const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

const day = ref(tomorrowStr),
  time = ref('14:30'),
  place = ref(pickupPoints[0])

const slots = Array.from(
  { length: 25 },
  (_, i) => String(9 + Math.floor(i / 2)).padStart(2, '0') + ':' + (i % 2 ? '30' : '00'),
)

const pickupNotes = {
  '本部图书馆南门（有监控）': '本部核心安全区域 · 全天监控覆盖',
  三舍楼下服务点: '靠近宿舍生活区 · 取放便利',
  二食堂门口: '人流密集醒目点位 · 适合白天面交',
  B栋教学楼大门口: '新校区教学楼正门 · 课间交接快捷',
}

const isSlotDisabled = (slot) => {
  if (!day.value) return false
  return new Date(day.value + 'T' + slot) <= new Date()
}

const state = useLoad(() => get('/orders/' + id)),
  { busy, issue, run } = useAction()

const canSubmit = computed(() => Boolean(day.value && time.value && place.value && !isSlotDisabled(time.value)))

function save() {
  if (!canSubmit.value) return
  confirmAction(
    '确认预约校内面交',
    `时间：${day.value} ${time.value}\n自提点：${place.value}\n\n确认后流转单将进入「待面交」状态并生成一次性核销码。`,
    () =>
      run(async () => {
        if (new Date(day.value + 'T' + time.value) <= new Date()) throw new Error('请选择未来时段')
        await post('/orders/' + id + '/appointment', {
          appointTime: day.value + ' ' + time.value + ':00',
          appointPlace: place.value,
        })
        notify('面交预约成功')
        router.push('/order/' + id)
      }),
  )
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title">
      <h1>预约面交</h1>
      <small>选择 09:00–21:00 半小时时段与校内固定安全自提点，不做跨天盲约</small>
    </header>
    <LoadState :state="state" v-slot="{ data }">
      <form v-if="data.orderStatus === 1" class="split-desk" @submit.prevent="save">
        <section class="panel stack">
          <div class="two-col">
            <label class="field">
              <span><Calendar :size="14" /> 面交日期</span>
              <input v-model="day" type="date" :min="todayStr" required />
            </label>
            <div class="field">
              <span>当前已选</span>
              <div class="selected-preview">{{ day }} {{ time }} · {{ place }}</div>
            </div>
          </div>

          <div class="field">
            <span><Clock :size="14" /> 选择半小时时段（09:00–21:00）</span>
            <div class="slot-grid">
              <button
                v-for="t in slots"
                :key="t"
                type="button"
                class="slot-btn"
                :class="{ active: time === t }"
                :disabled="isSlotDisabled(t)"
                @click="time = t"
              >
                {{ t }}
              </button>
            </div>
          </div>

          <div class="field">
            <span><MapPin :size="14" /> 校内自提点（4 处安全点位）</span>
            <div class="pickup-grid">
              <button
                v-for="p in pickupPoints"
                :key="p"
                type="button"
                class="choice pickup-card"
                :class="{ selected: place === p }"
                @click="place = p"
              >
                <b>{{ p }}</b>
                <small>{{ pickupNotes[p] }}</small>
              </button>
            </div>
          </div>

          <p v-if="issue" role="alert" class="error">{{ issue }}</p>
          <div class="actions">
            <button class="primary" :disabled="busy || !canSubmit">确认预约</button>
            <RouterLink class="btn" :to="'/order/' + id">返回流转单</RouterLink>
          </div>
        </section>

        <aside class="stack">
          <section class="panel stack">
            <h3>流转单摘要</h3>
            <div class="kv"><span>单号</span><b>{{ data.orderNo }}</b></div>
            <div class="kv"><span>流转物品</span><b>{{ data.itemTitle || data.item?.title }}</b></div>
            <div class="kv"><span>状态</span><span class="tag sky">{{ orderStates[data.orderStatus] }}</span></div>
          </section>

          <section class="panel tinted stack">
            <h3><ShieldCheck :size="15" /> 面交核销规则</h3>
            <ul class="rule-list">
              <li><b>角色隔离：</b>预约提交后生成一次性 8 位核销码，仅物品所有者可见可出示二维码。</li>
              <li><b>当面核销：</b>发起方当面验收实物无误后再输入/扫描核销码完成交割。</li>
              <li><b>超时守约：</b>超预约时间 24 小时未核销系统自动判违约解锁并扣除违约方 10 信用分。</li>
            </ul>
          </section>
        </aside>
      </form>
      <p v-else class="panel">当前状态为{{ orderStates[data.orderStatus] }}，无法预约。</p>
    </LoadState>
  </main>
</template>

<style scoped>
.two-col {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 14px;
  align-items: end;
}
.selected-preview {
  min-height: 41px;
  padding: 9px 12px;
  border-radius: 9px;
  background: #edf2ff;
  color: #303e82;
  font-weight: 600;
  font-size: 13.5px;
  display: flex;
  align-items: center;
}
.slot-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}
.slot-btn {
  min-height: 34px;
  padding: 0 6px;
  font-size: 13px;
  border-radius: 7px;
  font-variant-numeric: tabular-nums;
}
.slot-btn.active {
  background: #303e82;
  border-color: #303e82;
  color: #ffffff;
  font-weight: 700;
}
.pickup-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.pickup-card {
  border-radius: 10px;
  padding: 12px 14px;
}
.field > span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.rule-list {
  margin: 0;
  padding-left: 16px;
  display: grid;
  gap: 8px;
  font-size: 13px;
  color: #384056;
}
h3 {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
