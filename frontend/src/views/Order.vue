<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { itemById, sample } from '../data'
import { confirmAction, info, notify } from '../feedback'
const order = computed(() => sample.order),
  router = useRouter()
const parties = computed(() => [
  ['张', 96, '发起方 · 计算机学院', itemById(order.value.offerId)],
  ['李', 88, '接收方 · 数学学院', itemById(order.value.targetId)],
])
const rules = '请在预约时间前后 30 分钟内到场，扫码核销即视为交付完成。无正当理由爽约将扣 10 分信用分。'
function cancel() {
  confirmAction('取消交换', '确认取消本次演示交换？', () => {
    order.value.canceled = true
    notify('本次交换已取消')
  })
}
</script>
<template>
  <main class="wrap">
    <div class="heading">
      <div>
        <div class="inline">
          <h1>流转单</h1>
          <span class="tag gold">{{
            order.canceled ? '已取消' : order.appointment ? '已预约 · 待面交' : '已确认 · 待预约面交'
          }}</span>
        </div>
        <p class="subtitle">单号 20261026000123 · 创建于 2026-10-26 14:32</p>
      </div>
      <button @click="info('面交流转协议', rules)">查看协议</button>
    </div>
    <div class="panel steps">
      <div
        v-for="(s, i) in ['已提交', '已确认', '待面交', '已完成']"
        :class="{ done: i <= (order.appointment ? 2 : 1) }"
      >
        <span>{{ i === 0 ? '✓' : i + 1 }}</span
        >{{ s }}
      </div>
    </div>
    <div class="columns">
      <div class="stack">
        <section class="panel">
          <h3>交换双方</h3>
          <div class="parties">
            <template v-for="([n, credit, role, item], i) in parties"
              ><b v-if="i" class="positive">⇄</b>
              <div class="panel party">
                <div class="inline">
                  <span class="avatar">{{ n }}</span>
                  <div>
                    <b>{{ n }}同学</b> <span class="tag mint">信用 {{ credit }}</span>
                    <div class="small">{{ role }}</div>
                  </div>
                </div>
                <hr />
                <div class="inline">
                  <span class="tile mini" :class="item.color">{{ item.label }}</span>
                  <div>
                    <b>{{ item.title }}</b>
                    <p class="small subtitle">{{ item.condition }} · {{ item.campus }}</p>
                  </div>
                </div>
              </div></template
            >
          </div>
        </section>
        <section class="panel">
          <div class="spread">
            <h3>面交信息</h3>
            <span class="tag sky">{{ order.appointment ? '已预约' : '未预约' }}</span>
          </div>
          <div class="spread meet">
            <p class="small">
              {{
                order.appointment
                  ? order.appointment.date + ' ' + order.appointment.time + ' · ' + order.appointment.place
                  : '还没有约定面交时间，请双方尽快预约。'
              }}<br />预约后系统会生成核销二维码，面交时扫码完成交付。
            </p>
            <button class="primary" :disabled="order.canceled" @click="router.push('/appointment')">
              {{ order.appointment ? '查看预约' : '预约面交' }}
            </button>
          </div>
        </section>
        <section class="panel">
          <h3>交换留言</h3>
          <div class="panel tinted meet">
            <small>张同学 · 14:32</small>
            <p>{{ order.message }}</p>
          </div>
        </section>
        <section class="panel spread">
          <small><b>面交提醒：</b>{{ rules }}</small
          ><button class="chip" @click="info('流转规则', rules)">查看流转规则</button>
        </section>
      </div>
      <aside class="stack">
        <section class="panel stack tight">
          <h3>操作</h3>
          <button class="primary" :disabled="order.canceled" @click="router.push('/appointment')">
            预约面交</button
          ><button @click="info('联系对方', '李同学 · 本部校区。双方可在预约页选择面交时间与地点。')">
            联系对方</button
          ><button class="danger" :disabled="order.canceled" @click="cancel">取消交换</button
          ><small>取消后双方物品将立即解锁回到「在售」。<br />对方 24 小时未响应，系统自动取消。</small>
        </section>
        <section class="panel">
          <h3>流转记录</h3>
          <ul class="timeline">
            <li v-if="order.canceled">本次交换已取消</li>
            <li v-if="order.appointment">
              已预约面交<small>{{ order.appointment.date }} {{ order.appointment.time }}</small>
            </li>
            <li
              v-for="[s, t] in [
                ['对方已确认交换', '15:02'],
                ['你发起了交换意向', '14:32'],
                ['双方物品锁定', '14:32'],
              ]"
            >
              {{ s }}<small>10-26 {{ t }}</small>
            </li>
          </ul>
        </section>
      </aside>
    </div>
  </main>
</template>
<style scoped>
.steps {
  display: flex;
  margin-bottom: 14px;
  padding: 16px 24px;
}
.steps > div {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #929aa4;
  flex: 1;
}
.steps > div:last-child {
  flex: none;
}
.steps > div:not(:last-child)::after {
  content: '';
  height: 2px;
  background: #e6e8eb;
  flex: 1;
  margin-right: 10px;
}
.steps > div.done::after {
  background: var(--green);
}
.steps span {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  background: #f1f3f5;
  border-radius: 50%;
  font-weight: bold;
}
.steps .done {
  color: var(--green);
}
.steps .done span {
  background: var(--green);
  color: white;
}
.parties {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 14px;
  margin-top: 14px;
}
.party {
  padding: 14px;
}
.parties > b {
  font-size: 23px;
}
.meet {
  margin-top: 16px;
}
.meet p {
  line-height: 1.9;
}
@media (max-width: 620px) {
  .parties {
    grid-template-columns: 1fr;
  }
  .parties > b {
    display: none;
  }
  .steps {
    padding: 10px;
  }
  .steps > div {
    gap: 3px;
    font-size: 11px;
  }
}
</style>
