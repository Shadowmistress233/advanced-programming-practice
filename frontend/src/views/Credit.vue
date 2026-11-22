<script setup>
import { computed, ref, watch } from 'vue'
import { AlertCircle, Award, CheckCircle2, FileWarning, ShieldCheck, Star } from '@lucide/vue'
import { get, post, useLoad, useAction, user, pageOf, creditLevelOf } from '../api'
import LoadState from '../components/LoadState.vue'
import { confirmAction, notify } from '../feedback'
import Pager from '../components/Pager.vue'

const tab = ref('logs'),
  page = ref(1),
  selected = ref(null),
  reason = ref('')
watch(tab, () => {
  page.value = 1
  selected.value = null
})

const state = useLoad(
  () =>
    tab.value === 'logs'
      ? get('/credits/logs', { page: page.value, pageSize: 12 })
      : get('/reviews', { userId: user.value.userId, page: page.value, pageSize: 12 }),
  [tab, page],
)
const summary = useLoad(() => get('/credits/logs', { page: 1, pageSize: 1 }))

const { busy, issue, run } = useAction()
function appeal() {
  confirmAction('提交积分扣分申诉', '每条扣分流水仅可申诉一次，将写入后台工单由管理员复核。确认提交？', () =>
    run(async () => {
      await post('/credits/appeals', { creditLogId: selected.value, reason: reason.value })
      selected.value = null
      reason.value = ''
      await state.reload()
      notify('积分申诉已提交，可在列表查看复核进度')
    }),
  )
}

const scorePct = computed(() => {
  const s = Number(summary.data.value?.creditScore ?? user.value?.creditScore ?? 96)
  return Math.max(0, Math.min(100, s))
})
const currentLevel = computed(() => summary.data.value?.level || creditLevelOf(user.value?.creditScore))

const appealBadge = (s) => {
  if (s === 0) return { label: '申诉待复核', cls: 'gold' }
  if (s === 1) return { label: '申诉已通过', cls: 'mint' }
  if (s === 2) return { label: '申诉已驳回', cls: 'rose' }
  return null
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title">
      <h1>信用档案</h1>
      <small>初始分 100 · 发布 +2 / 成交 +5 / 好评 +3 / 捐赠 +5 / 爽约 -10 / 举报核实 -15</small>
    </header>

    <section v-if="summary.data.value" class="two overview-grid">
      <div class="credit-hero">
        <div class="spread">
          <div>
            <small>当前校园诚信积分</small>
            <div class="score-num">
              <b>{{ summary.data.value.creditScore }}</b>
              <span>/ 100</span>
              <span class="level-pill">{{ currentLevel }}</span>
            </div>
          </div>
          <ShieldCheck :size="36" :stroke-width="1.6" style="opacity: 0.85" />
        </div>
        <div class="score-track">
          <div class="score-fill" :style="{ width: scorePct + '%' }"></div>
        </div>
        <div class="tier-scale">
          <span>&lt;40 观察期</span>
          <span>40–59 受限(3件)</span>
          <span>60–74 一般</span>
          <span>75–89 良好</span>
          <b>≥90 优秀</b>
        </div>
      </div>

      <div class="panel stack tight">
        <div class="spread">
          <h3><Award :size="16" /> 履约评价标签云</h3>
          <span class="tag gold">
            <Star :size="12" /> 均分 {{ summary.data.value.avgScore ?? 4.7 }} · {{ summary.data.value.reviewCount ?? 3 }} 条评价
          </span>
        </div>
        <div class="tag-cloud">
          <span
            v-for="t in summary.data.value.tags || []"
            :key="t.label"
            class="tag mint"
          >
            {{ t.label }} ({{ t.count }})
          </span>
        </div>
        <p class="small">规则提示：每条扣分记录支持发起 1 次申诉，复核通过后按实扣分值全额回补。</p>
      </div>
    </section>

    <div class="spread">
      <div class="seg-tabs" role="tablist" aria-label="信用记录切换">
        <button type="button" class="seg-tab" :class="{ active: tab === 'logs' }" @click="tab = 'logs'">
          积分流水
        </button>
        <button type="button" class="seg-tab" :class="{ active: tab === 'reviews' }" @click="tab = 'reviews'">
          收到的评价
        </button>
      </div>
    </div>

    <LoadState :state="state" v-slot="{ data }">
      <div class="stack tight">
        <article
          v-for="r in pageOf(data)?.list"
          :key="r.creditLogId ?? r.reviewId ?? r.id"
          class="ledger-row"
        >
          <div class="log-left">
            <span
              v-if="tab === 'logs'"
              class="delta-badge"
              :class="r.changeValue >= 0 ? 'mint' : 'rose'"
            >
              {{ r.changeValue > 0 ? '+' + r.changeValue : r.changeValue }}
            </span>
            <span v-else class="delta-badge gold">{{ r.score }}★</span>
            <div>
              <small>
                {{ r.createTime }}
                <template v-if="r.orderNo"> · 关联单号 {{ r.orderNo }}</template>
                <template v-if="r.reviewerName"> · 来自 {{ r.reviewerName }}</template>
              </small>
              <b>{{ r.remark || r.content || r.reasonType }}</b>
              <div v-if="r.tags?.length" class="actions" style="margin-top: 4px; gap: 6px">
                <span v-for="tg in r.tags" :key="tg" class="tag">{{ tg }}</span>
              </div>
            </div>
          </div>

          <div v-if="tab === 'logs'" class="actions">
            <span v-if="appealBadge(r.appealStatus)" class="tag" :class="appealBadge(r.appealStatus).cls">
              <CheckCircle2 v-if="r.appealStatus === 1" :size="12" />
              <AlertCircle v-else-if="r.appealStatus === 0" :size="12" />
              <span>{{ appealBadge(r.appealStatus).label }}</span>
            </span>
            <button
              v-if="r.changeValue < 0 && r.appealStatus == null"
              @click="selected = r.creditLogId ?? r.id"
            >
              <FileWarning :size="14" />
              <span>发起申诉</span>
            </button>
          </div>
        </article>
      </div>
      <p v-if="!pageOf(data)?.list?.length" class="empty">暂无记录</p>
      <Pager v-if="pageOf(data)?.pages > 1" v-model:page="page" :total="pageOf(data).pages" />
    </LoadState>

    <form v-if="selected" class="panel stack" @submit.prevent="appeal">
      <div class="spread">
        <h3>对扣分流水 #{{ selected }} 提交申诉</h3>
        <button type="button" class="text" @click="selected = null">取消</button>
      </div>
      <label class="field">
        <span>申诉理由与情况说明（最多 500 字）</span>
        <textarea v-model="reason" rows="2" required maxlength="500" placeholder="例如：已提前与对方沟通顺延时间或属系统误判…" />
      </label>
      <button class="primary" :disabled="busy" style="justify-self: start">提交申诉至管理员</button>
    </form>
    <p v-if="issue" role="alert" class="error">{{ issue }}</p>
  </main>
</template>

<style scoped>
.credit-hero {
  background: #303e82;
  color: #ffffff;
  border-radius: 8px;
  padding: 18px 22px;
  display: grid;
  gap: 10px;
}
.credit-hero small {
  color: #d6dcf5;
}
.score-num {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-top: 2px;
}
.score-num b {
  font-size: 36px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.level-pill {
  padding: 2px 10px;
  border-radius: 99px;
  background: #f7ce7d;
  color: #24253d;
  font-size: 12.5px;
  font-weight: 700;
}
.score-track {
  height: 7px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.2);
  overflow: hidden;
}
.score-fill {
  height: 100%;
  border-radius: 99px;
  background: #34d399;
}
.tier-scale {
  display: flex;
  justify-content: space-between;
  font-size: 11.5px;
  color: #d6dcf5;
}
.tier-scale b {
  color: #f7ce7d;
}
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 0;
}
.log-left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.delta-badge {
  min-width: 52px;
  height: 36px;
  border-radius: 8px;
  display: inline-grid;
  place-items: center;
  font-weight: 700;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  flex: none;
}
h3 {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
