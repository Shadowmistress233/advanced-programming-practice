<script setup>
import { computed, ref } from 'vue'
import { sample } from '../data'
import { confirmAction, notify } from '../feedback'
const tab = ref('全部'),
  reason = ref(''),
  record = ref('')
const logs = [
  ['完成一次以物易物', '2026-10-24 16:20 · 关联单 20261024000098', 5],
  ['收到好评「物品与描述一致」', '2026-10-24 16:35 · 关联单 20261024000098', 3],
  ['发布闲置物品', '2026-10-26 09:12 · 关联物品 #1024', 2],
  ['超时未交付，系统判定违约', '2026-10-18 21:00 · 关联单 20261018000042', -10],
  ['捐赠物资，公益记录', '2026-10-12 10:26 · 凭证 CSU202610000123', 5],
]
const filtered = computed(() =>
  logs.filter(
    ([, , n]) =>
      tab.value === '全部' ||
      (tab.value === '加分' && n > 0) ||
      (tab.value === '扣分' && n < 0) ||
      (tab.value === '申诉中' && n < 0 && sample.appeal),
  ),
)
function appeal() {
  confirmAction('提交申诉', '确认提交本次扣分记录的申诉说明？', () => {
    sample.appeal = reason.value
    tab.value = '申诉中'
    notify('已保存演示申诉')
  })
}
</script>
<template>
  <main class="wrap">
    <div class="heading">
      <div>
        <h1>信用档案</h1>
        <p class="subtitle">信用分由履约、评价、违约与公益行为共同决定，低于 60 分将限制发布</p>
      </div>
    </div>
    <div class="credit-layout">
      <div class="stack">
        <section class="score">
          <div class="spread">
            <div>当前信用分<strong>96</strong></div>
            <b>优秀</b>
          </div>
          <div class="track"><i></i></div>
          <div class="spread">
            <span v-for="s in ['受限 0', '一般 60', '良好 70', '优秀 90']">{{ s }}</span>
          </div>
        </section>
        <div class="panel">
          <h3>等级权益</h3>
          <div
            class="kv"
            v-for="[k, v] in [
              ['同时在售上限', '10 件'],
              ['优先推荐', '已开启'],
              ['免押金预约', '已开启'],
              ['违约记录', '1 次（已过观察期）'],
            ]"
          >
            <span>{{ k }}</span
            ><b :class="{ positive: v === '已开启' }">{{ v }}</b>
          </div>
        </div>
        <div class="panel">
          <h3>评价标签</h3>
          <div class="actions subtitle">
            <span
              v-for="(t, i) in ['准时 12', '物品与描述一致 9', '沟通顺畅 8', '热情 5', '包装仔细 3']"
              class="tag"
              :class="{ mint: i < 3 }"
              >{{ t }}</span
            >
          </div>
        </div>
      </div>
      <div class="stack">
        <section class="panel">
          <div class="spread">
            <h3>积分流水</h3>
            <div class="actions">
              <button
                v-for="t in ['全部', '加分', '扣分', '申诉中']"
                class="chip"
                :class="{ chosen: tab === t }"
                @click="tab = t"
              >
                {{ t }}
              </button>
            </div>
          </div>
          <ul class="timeline">
            <li v-for="[name, time, n] in filtered">
              <div class="spread">
                <b>{{ name }}</b
                ><b :class="n > 0 ? 'positive' : 'danger'">{{ n > 0 ? '+' : '' }}{{ n }}</b>
              </div>
              <small>{{ time }}</small>
            </li>
          </ul>
          <p class="empty" v-if="!filtered.length">暂无申诉中的记录</p>
        </section>
        <section class="panel">
          <div class="spread">
            <h3>进行一次申诉</h3>
            <span class="tag">被扣分后 7 天内可申请一次</span>
          </div>
          <form class="appeal" @submit.prevent="appeal">
            <select v-model="record" required aria-label="扣分记录">
              <option value="" disabled>选择要申诉的扣分记录</option>
              <option>超时未交付，系统判定违约</option></select
            ><input
              v-model.trim="reason"
              required
              placeholder="说明申诉理由..."
              aria-label="申诉理由"
            /><button :disabled="!!sample.appeal">{{ sample.appeal ? '已申诉' : '提交申诉' }}</button>
          </form>
        </section>
      </div>
    </div>
  </main>
</template>
<style scoped>
.credit-layout {
  display: grid;
  grid-template-columns: 31% minmax(0, 1fr);
  gap: 24px;
}
.score {
  border-radius: 16px;
  background: linear-gradient(135deg, #108968, #0c6954);
  color: white;
  padding: 24px;
}
.score strong {
  display: block;
  font-size: 48px;
  line-height: 1.3;
}
.score b {
  display: grid;
  place-items: center;
  width: 82px;
  height: 82px;
  border: 4px solid #ffffff40;
  border-radius: 50%;
}
.score .track {
  background: #ffffff38;
  height: 6px;
  border-radius: 20px;
  margin: 18px 0 7px;
}
.track i {
  display: block;
  background: #e2fff1;
  width: 96%;
  height: 100%;
  border-radius: 20px;
}
.track + .spread {
  font-size: 12px;
}
.appeal {
  display: grid;
  grid-template-columns: 1fr 1.8fr auto;
  gap: 12px;
  margin-top: 16px;
}
.timeline {
  margin-top: 18px;
}
.timeline li {
  padding-bottom: 16px;
}
@media (max-width: 760px) {
  .credit-layout {
    grid-template-columns: 1fr;
  }
  .appeal {
    grid-template-columns: 1fr;
  }
}
</style>
