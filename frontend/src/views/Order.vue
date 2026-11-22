<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  QrCode,
  ShieldCheck,
  Star,
  User,
  XCircle,
} from '@lucide/vue'
import { get, post, file, useLoad, useAction, user, pageOf, orderStates, mediaUrl } from '../api'
import { useRoute } from 'vue-router'
import LoadState from '../components/LoadState.vue'
import { confirmAction, notify } from '../feedback'
import Pager from '../components/Pager.vue'

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
  showCancel = ref(false),
  code = ref(''),
  score = ref(5),
  content = ref(''),
  selectedTags = ref(['准时守约', '描述一致']),
  submitted = ref(false),
  qr = ref('')

const presetTags = ['准时守约', '描述一致', '沟通顺畅', '成色很新', '耐心细致']

onUnmounted(() => URL.revokeObjectURL(qr.value))

function toggleTag(tag) {
  const idx = selectedTags.value.indexOf(tag)
  if (idx >= 0) selectedTags.value.splice(idx, 1)
  else selectedTags.value.push(tag)
}

function act(op, body, confirmTitle, confirmBody) {
  const exec = () =>
    run(async () => {
      await post('/orders/' + id + '/' + op, body)
      showCancel.value = false
      reason.value = ''
      await state.reload()
      notify('流转单已更新')
    })
  if (confirmTitle) confirmAction(confirmTitle, confirmBody, exec)
  else exec()
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
      tags: selectedTags.value.join(','),
    })
    submitted.value = true
    notify('评价已提交，感谢反馈')
    await state.reload()
  })
}

const stepIndex = computed(() => {
  const s = state.data.value?.orderStatus
  if (s === 0) return 0
  if (s === 1) return 1
  if (s === 2) return 2
  if (s === 3) return 3
  return -1
})

const orderTone = (s) => (['gold', 'sky', 'violet', 'mint', 'ink', 'rose'][s] || '')
</script>
<template>
  <main class="wrap live">
    <header class="page-title">
      <h1>{{ id ? '流转单详情' : '我的流转' }}</h1>
      <small v-if="id">全流程状态追踪 · 所有者出码、发起方核销</small>
      <small v-else>按我发起的 / 我收到的查看流转单与履约进度</small>
    </header>

    <div class="spread" v-if="!id" style="flex-wrap: wrap">
      <div class="seg-tabs" role="tablist" aria-label="身份切换">
        <button type="button" class="seg-tab" :class="{ active: roleType === 'from' }" @click="roleType = 'from'">
          我发起的
        </button>
        <button type="button" class="seg-tab" :class="{ active: roleType === 'to' }" @click="roleType = 'to'">
          我收到的
        </button>
      </div>
      <div class="seg-tabs" role="tablist" aria-label="状态筛选">
        <button type="button" class="seg-tab" :class="{ active: orderStatus === '' }" @click="orderStatus = ''">
          全部
        </button>
        <button
          v-for="(s, i) in orderStates"
          :key="i"
          type="button"
          class="seg-tab"
          :class="{ active: orderStatus === i }"
          @click="orderStatus = i"
        >
          {{ s }}
        </button>
      </div>
    </div>

    <LoadState :state="state" v-slot="{ data }">
      <template v-if="!id">
        <div class="stack tight">
          <RouterLink
            class="ledger-row"
            v-for="o in data.list"
            :key="o.orderId ?? o.id"
            :to="'/order/' + (o.orderId ?? o.id)"
          >
            <div>
              <small>{{ o.orderNo }} · {{ o.createTime }}</small>
              <div class="inline">
                <b>{{ o.itemTitle || o.orderNo }}</b>
                <span class="tag" :class="o.tradeMode === 'exchange' ? 'mint' : 'sky'">
                  {{ o.tradeMode === 'exchange' ? '以物易物' : '低价寄售' }}
                </span>
              </div>
              <small v-if="o.appointTime">预约：{{ o.appointTime }} · {{ o.appointPlace }}</small>
            </div>
            <div class="inline">
              <span class="tag" :class="orderTone(o.orderStatus)">{{ orderStates[o.orderStatus] }}</span>
              <span>详情 →</span>
            </div>
          </RouterLink>
        </div>
        <p v-if="!data.list.length" class="empty">暂无流转单</p>
        <Pager v-if="pageOf(data)?.pages > 1" v-model:page="page" :total="pageOf(data).pages" />
      </template>

      <template v-else>
        <!-- 4 步状态步骤条 / 异常关单横幅 -->
        <section v-if="data.orderStatus <= 3" class="panel stepper" aria-label="流转进度">
          <div
            v-for="(label, idx) in ['1. 提交意向', '2. 接单确认', '3. 预约待面交', '4. 核销完成']"
            :key="label"
            class="step-item"
            :class="{ done: idx < stepIndex, current: idx === stepIndex }"
          >
            <span class="step-dot">{{ idx < stepIndex ? '✓' : idx + 1 }}</span>
            <b>{{ label }}</b>
          </div>
        </section>
        <section v-else class="panel notice spread">
          <div class="inline">
            <AlertTriangle :size="18" />
            <div>
              <b>当前流转单状态：{{ orderStates[data.orderStatus] }}</b>
              <p class="small">关闭原因：{{ data.closeReason || '流转已终止，相关锁定物品已释放' }}</p>
            </div>
          </div>
          <span class="tag" :class="orderTone(data.orderStatus)">{{ orderStates[data.orderStatus] }}</span>
        </section>

        <div class="split-desk">
          <!-- 左栏：当前可执行操作区 -->
          <section class="panel stack">
            <div class="spread">
              <div>
                <small>单号 {{ data.orderNo }}</small>
                <h2>{{ data.itemTitle || data.item?.title }}</h2>
              </div>
              <span class="tag" :class="orderTone(data.orderStatus)">{{ orderStates[data.orderStatus] }}</span>
            </div>

            <!-- 状态 0：待确认 -->
            <div v-if="data.orderStatus === 0" class="action-box stack">
              <template v-if="data.toUserId === user?.userId">
                <p>发起方「{{ data.fromUserName || '校内同学' }}」向你提交了流转申请，确认接单后即可协商校内自提点预约面交。</p>
                <div class="actions">
                  <button
                    class="primary"
                    :disabled="busy"
                    @click="act('confirm', {}, '确认接单', '接单后将进入预约面交阶段，请在 48 小时内完成时间地点预约。')"
                  >
                    <CheckCircle2 :size="15" :stroke-width="1.8" />
                    <span>确认接单</span>
                  </button>
                </div>
              </template>
              <p v-else class="small">已锁定物品并等待物品所有者确认接单（超过 24 小时未接单将自动取消并解锁）。</p>
            </div>

            <!-- 状态 1：已确认 -> 去预约 -->
            <div v-if="data.orderStatus === 1" class="action-box stack">
              <p>双方已确认流转，请在 48 小时内选择 09:00–21:00 校内自提点完成面交预约。</p>
              <div class="actions">
                <RouterLink class="btn primary" :to="'/appointment/' + id">
                  <CalendarClock :size="15" :stroke-width="1.8" />
                  <span>预约面交</span>
                </RouterLink>
              </div>
            </div>

            <!-- 状态 2：待面交 -> 角色隔离出码 / 核销 -->
            <div v-if="data.orderStatus === 2" class="action-box stack">
              <div class="appoint-banner">
                <Clock :size="16" />
                <div>
                  <b>预约面交：{{ data.appointTime }}</b>
                  <small>校内自提点：{{ data.appointPlace }} · 超过预约时间 24 小时未核销将自动闭单违约</small>
                </div>
              </div>

              <template v-if="data.toUserId === user?.userId">
                <p class="small">你是物品所有者，请在自提点交付实物时向发起方出示核销二维码：</p>
                <div class="actions">
                  <button class="primary" :disabled="busy" @click="showCode">
                    <QrCode :size="15" :stroke-width="1.8" />
                    <span>出示核销二维码</span>
                  </button>
                </div>
                <div v-if="qr" class="qr-card">
                  <img :src="qr" width="160" height="160" alt="核销二维码" />
                  <div class="qr-meta">
                    <b>一次性面交核销码</b>
                    <small>请当面验货后向发起方出示，由发起方扫码或输入 8 位核销码完成核销；单据核销前禁止自行确认。</small>
                  </div>
                </div>
              </template>

              <form
                v-if="data.fromUserId === user?.userId"
                class="stack"
                @submit.prevent="act('verify', { verifyCode: code }, '确认完成面交核销', '确认实物无误并核销该流转单？核销后双方各加 5 信用分。')"
              >
                <label class="field">
                  <span>你是流转发起方 · 当面验货后输入 8 位核销码</span>
                  <input v-model.trim="code" required placeholder="输入所有者出示的 8 位核销码" />
                </label>
                <div class="actions">
                  <button class="primary" :disabled="busy">
                    <ShieldCheck :size="15" :stroke-width="1.8" />
                    <span>确认核销</span>
                  </button>
                </div>
              </form>
            </div>

            <!-- 状态 3：已完成 -> 7 天内履约评价 -->
            <form
              v-if="data.orderStatus === 3 && !data.reviewed && !submitted"
              class="stack"
              @submit.prevent="review"
            >
              <h3><Star :size="16" /> 履约评价（完成后 7 天内可互评一次）</h3>
              <div class="field">
                <span>评分（{{ score }} 星）</span>
                <div class="actions">
                  <button
                    v-for="n in 5"
                    :key="n"
                    type="button"
                    class="star-btn"
                    :class="{ active: score >= n }"
                    @click="score = n"
                  >
                    {{ n }} 星
                  </button>
                </div>
              </div>
              <div class="field">
                <span>快捷评价标签</span>
                <div class="actions">
                  <button
                    v-for="t in presetTags"
                    :key="t"
                    type="button"
                    class="seg-tab"
                    :class="{ active: selectedTags.includes(t) }"
                    @click="toggleTag(t)"
                  >
                    {{ t }}
                  </button>
                </div>
              </div>
              <label class="field">
                <span>文字评价</span>
                <textarea v-model="content" rows="2" maxlength="500" required placeholder="分享本次校内面交体验…" />
              </label>
              <button class="primary" :disabled="busy">提交评价</button>
            </form>
            <p v-else-if="data.orderStatus === 3" class="small">本流转单已完成评价或处于归档状态。</p>

            <!-- 次要取消入口：默认折叠，避免横在主体中 -->
            <div v-if="[0, 1, 2].includes(data.orderStatus)" class="cancel-footer">
              <button type="button" class="text danger" @click="showCancel = !showCancel">
                <XCircle :size="14" />
                <span>{{ showCancel ? '收起取消面板' : '需要取消本次流转？' }}</span>
              </button>
              <form
                v-if="showCancel"
                class="stack"
                style="margin-top: 10px"
                @submit.prevent="act('cancel', { closeReason: reason }, '确认取消流转', '取消后流转单关闭，已锁定物品将即时释放，确认继续？')"
              >
                <input
                  v-model.trim="reason"
                  placeholder="请输入取消原因（最多 255 字）"
                  aria-label="取消原因"
                  required
                  maxlength="255"
                />
                <button :disabled="busy" class="danger">
                  <XCircle :size="14" />
                  <span>确认取消流转</span>
                </button>
              </form>
            </div>
          </section>

          <!-- 右栏：双方物品对比 + 双方信息 + 预约与规则 -->
          <aside class="stack">
            <section class="panel stack">
              <div class="spread">
                <h3>关联物品明细</h3>
                <span class="tag" :class="data.tradeMode === 'exchange' ? 'mint' : 'sky'">
                  {{ data.tradeMode === 'exchange' ? '以物易物' : '低价寄售' }}
                </span>
              </div>
              <div class="mini-item">
                <div class="mini-cover">
                  <img v-if="data.item?.coverUrl" :src="mediaUrl(data.item.coverUrl)" alt="" />
                  <Package v-else :size="20" />
                </div>
                <div>
                  <small>目标物品</small>
                  <b>{{ data.itemTitle || data.item?.title }}</b>
                  <small v-if="data.item">
                    {{ data.item.campus }} · {{ data.item.conditionLevel }} ·
                    {{ data.item.tradeMode === 'exchange' ? '期望：' + data.item.expectItem : '¥' + data.item.price }}
                  </small>
                </div>
              </div>
              <div v-if="data.offerItem || data.offerItemTitle" class="mini-item swap-row">
                <div class="mini-cover">
                  <img v-if="data.offerItem?.coverUrl" :src="mediaUrl(data.offerItem.coverUrl)" alt="" />
                  <ArrowLeftRight v-else :size="20" />
                </div>
                <div>
                  <small>换出物品</small>
                  <b>{{ data.offerItemTitle || data.offerItem?.title }}</b>
                  <small v-if="data.offerItem">{{ data.offerItem.campus }} · {{ data.offerItem.conditionLevel }}</small>
                </div>
              </div>
            </section>

            <section class="panel stack">
              <h3>交易双方与预约摘要</h3>
              <div class="kv">
                <span><User :size="13" /> 发起方</span>
                <b>{{ data.fromUserName || '林同学' }} · 信用 {{ data.fromCredit ?? 96 }}</b>
              </div>
              <div class="kv">
                <span><ShieldCheck :size="13" /> 物品所有者</span>
                <b>{{ data.toUserName || '林小满' }} · 信用 {{ data.toCredit ?? 96 }}</b>
              </div>
              <div class="kv">
                <span><MapPin :size="13" /> 自提地点</span>
                <b>{{ data.appointPlace || '待预约选择校内自提点' }}</b>
              </div>
              <div class="kv">
                <span><CalendarClock :size="13" /> 预约时段</span>
                <b>{{ data.appointTime || '待确认预约' }}</b>
              </div>
            </section>
          </aside>
        </div>
      </template>
    </LoadState>
    <p v-if="issue" role="alert" class="error">{{ issue }}</p>
  </main>
</template>

<style scoped>
.stepper {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 14px 18px;
}
.step-item {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--muted);
  font-size: 13.5px;
}
.step-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #eceae2;
  color: #5b6274;
  display: inline-grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
  flex: none;
}
.step-item.done .step-dot {
  background: #e6f6f0;
  color: #0f8a6a;
}
.step-item.done {
  color: #0f8a6a;
}
.step-item.current .step-dot {
  background: #303e82;
  color: #ffffff;
}
.step-item.current {
  color: #303e82;
}
.appoint-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 9px;
  background: #f3ecfe;
  color: #5b21b6;
}
.appoint-banner b {
  display: block;
}
.qr-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #ffffff;
}
.qr-card img {
  display: block;
  flex: none;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
  image-rendering: pixelated;
}
.qr-meta b {
  display: block;
  margin-bottom: 4px;
  color: var(--ink);
}
.qr-meta small {
  display: block;
  line-height: 1.5;
  color: var(--muted);
}
.star-btn {
  min-height: 32px;
  padding: 0 10px;
  font-size: 12.5px;
}
.star-btn.active {
  background: #fef4d6;
  border-color: #f59e0b;
  color: #92550c;
}
.cancel-footer {
  padding-top: 12px;
  border-top: 1px dashed var(--line);
}
.mini-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 8px;
  background: #faf8f2;
  border: 1px solid var(--line);
}
.mini-item b {
  display: block;
}
.mini-cover {
  width: 54px;
  height: 54px;
  border-radius: 6px;
  background: #ffffff;
  border: 1px solid var(--line);
  display: grid;
  place-items: center;
  overflow: hidden;
  flex: none;
  color: var(--muted);
}
.mini-cover img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 3px;
}
.kv > span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
</style>
