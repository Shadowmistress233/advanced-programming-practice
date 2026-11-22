<script setup>
import { ref } from 'vue'
import { ArrowLeftRight, CheckCircle2, Lock, MapPin, Package, ShieldCheck, ShoppingBag, Sparkles } from '@lucide/vue'
import { get, post, useLoad, useAction, mediaUrl } from '../api'
import { useRoute, useRouter } from 'vue-router'
import LoadState from '../components/LoadState.vue'
import { confirmAction } from '../feedback'

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
  const target = state.data.value
  const tradeMode = target.tradeMode
  const lockTip =
    tradeMode === 'exchange'
      ? '提交后将同时锁定对方物品与你选中的换出物品，防止重复下单；若 24 小时未接单系统将自动成对解锁。'
      : '提交后将锁定目标物品并生成流转单；平台不接入线上资金交易，请等待对方确认并预约校内面交当面结清。'
  confirmAction('确认提交流转意向', lockTip, () =>
    run(async () => {
      const order = await post('/orders', {
        itemId: Number(id),
        tradeMode,
        ...(tradeMode === 'exchange' ? { offerItemId: Number(offer.value) } : {}),
        message: message.value,
      })
      router.push('/order/' + order.orderId)
    }),
  )
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title">
      <h1>发起交换</h1>
      <small>校内一对一锁单流转 · 防超卖、可追溯、超时自动释放</small>
    </header>
    <LoadState :state="state" v-slot="{ data }">
      <form class="split-desk" @submit.prevent="send">
        <section class="panel stack">
          <div class="spread">
            <h2>{{ data.tradeMode === 'exchange' ? '选择我的换出物品' : '确认寄售流转意向' }}</h2>
            <span class="tag" :class="data.tradeMode === 'exchange' ? 'mint' : 'sky'">
              {{ data.tradeMode === 'exchange' ? '以物易物模式' : '低价寄售模式' }}
            </span>
          </div>

          <template v-if="data.tradeMode === 'exchange'">
            <LoadState :state="offers" v-slot="{ data: offerPage }">
              <p class="small">必须从本人「在售」闲置中选择 1 件物品与对方一对一锁定交换：</p>
              <div v-if="offerPage.list?.length" class="offer-list">
                <button
                  v-for="v in offerPage.list"
                  :key="v.itemId ?? v.id"
                  type="button"
                  class="choice offer-card"
                  :class="{ selected: Number(offer) === Number(v.itemId ?? v.id) }"
                  @click="offer = v.itemId ?? v.id"
                >
                  <div class="offer-thumb">
                    <img v-if="v.coverUrl" :src="mediaUrl(v.coverUrl)" alt="" />
                    <Package v-else :size="20" />
                  </div>
                  <div class="offer-info">
                    <b>{{ v.title }}</b>
                    <small>{{ v.campus }} · {{ v.conditionLevel }} · {{ v.tradeMode === 'exchange' ? '换 ' + v.expectItem : '参考价 ¥' + v.price }}</small>
                  </div>
                  <CheckCircle2 v-if="Number(offer) === Number(v.itemId ?? v.id)" :size="18" class="offer-check" />
                </button>
              </div>
              <div v-else class="empty panel">
                <p>你当前没有「在售」状态的物品可用于交换</p>
                <RouterLink class="btn" to="/publish" style="margin-top: 10px">先去发布闲置</RouterLink>
              </div>
              <div v-if="offerPage.pages > 1" class="actions">
                <button type="button" :disabled="page === 1" @click="changePage(-1)">上一页</button>
                <button type="button" :disabled="page >= offerPage.pages" @click="changePage(1)">下一页</button>
              </div>
            </LoadState>
          </template>
          <div v-else class="consign-tip">
            <ShoppingBag :size="18" />
            <div>
              <b>当面验货与线下结清约定</b>
              <small>平台仅撮合校内意向与预约面交核销，不代收任何线上资金，请在校内自提点当面验货。</small>
            </div>
          </div>

          <label class="field">
            <span>给对方的留言（可选，最多 200 字）</span>
            <textarea
              v-model="message"
              rows="3"
              maxlength="200"
              placeholder="例如：今天下午下课后方便在自提点当面看看成色，期待回复！"
            />
          </label>
          <p v-if="issue" role="alert" class="error">{{ issue }}</p>
          <div class="actions">
            <button
              class="primary"
              :disabled="busy || (data.tradeMode === 'exchange' && !offer)"
            >
              <ArrowLeftRight v-if="data.tradeMode === 'exchange'" :size="15" />
              <ShoppingBag v-else :size="15" />
              <span>提交流转意向</span>
            </button>
            <RouterLink class="btn" :to="'/item/' + id">返回详情</RouterLink>
          </div>
        </section>

        <aside class="stack">
          <section class="panel stack">
            <div class="spread">
              <h3>目标物品摘要</h3>
              <span class="tag mint">在售可锁定</span>
            </div>
            <div class="target-preview">
              <div class="target-cover">
                <img v-if="data.coverUrl" :src="mediaUrl(data.coverUrl)" :alt="data.title" />
                <Package v-else :size="28" />
              </div>
              <div class="stack tight">
                <b>{{ data.title }}</b>
                <div class="target-price">
                  {{ data.tradeMode === 'exchange' ? '期望换：' + (data.expectItem || '闲置物品') : '寄售价：¥' + data.price }}
                </div>
                <small><Sparkles :size="12" /> {{ data.conditionLevel }} · <MapPin :size="12" /> {{ data.campus }}</small>
                <small>面交点：{{ data.tradePlace || '协商校内自提点' }}</small>
                <small>
                  <ShieldCheck :size="12" /> 发布人：{{ data.sellerNickname || '校内同学' }} · 信用分 {{ data.sellerCreditScore ?? 90 }}
                </small>
              </div>
            </div>
          </section>

          <section class="panel tinted stack">
            <h3><Lock :size="15" /> 双阶段防锁死保障</h3>
            <ul class="rule-list">
              <li><b>并发防重：</b>提交瞬间条件锁单，若已被其他同学抢先下单会立即提示重选。</li>
              <li><b>成对解锁：</b>对方 24 小时未接单或接单后 48 小时未预约，系统自动取消并释放双方物品。</li>
              <li><b>信用激励：</b>双方线下按约完成扫码核销，各得 <b>+5 信用分</b>。</li>
            </ul>
          </section>
        </aside>
      </form>
    </LoadState>
  </main>
</template>

<style scoped>
.offer-list {
  display: grid;
  gap: 10px;
}
.offer-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
}
.offer-thumb {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: #f6f4ec;
  display: grid;
  place-items: center;
  overflow: hidden;
  flex: none;
  color: var(--muted);
}
.offer-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.offer-info {
  flex: 1;
  min-width: 0;
}
.offer-check {
  color: var(--accent);
  flex: none;
}
.consign-tip {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border-radius: 10px;
  background: #eaf2ff;
  color: #1f3c7d;
}
.consign-tip b {
  display: block;
  margin-bottom: 3px;
}
.target-preview {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
.target-cover {
  width: 104px;
  height: 104px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: #ffffff;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: var(--muted);
}
.target-cover img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 4px;
}
.target-price {
  color: var(--accent);
  font-size: 16px;
  font-weight: 700;
}
.target-preview small {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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
