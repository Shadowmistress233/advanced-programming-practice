<script setup>
import { ref } from 'vue'
import {
  ArrowLeftRight,
  Clock,
  Eye,
  Flag,
  Gift,
  Heart,
  MapPin,
  Navigation,
  ShoppingBag,
  Sparkles,
  Tag,
  User,
} from '@lucide/vue'
import { get, post, useLoad, useAction, user, mediaUrl, itemStates } from '../api'
import { useRoute } from 'vue-router'
import LoadState from '../components/LoadState.vue'
import { confirmAction, notify } from '../feedback'

const id = useRoute().params.id,
  state = useLoad(() => get('/items/' + id))
const { busy, issue, run } = useAction(),
  favorite = ref(null),
  showReport = ref(false),
  type = ref('虚假描述'),
  content = ref(''),
  photo = ref('')
function toggle() {
  run(async () => {
    favorite.value = (await post('/items/' + id + '/favorite')).favorited
    notify(favorite.value ? '已加入收藏' : '已取消收藏')
  })
}
function report() {
  confirmAction('提交举报工单', '确认提交针对该物品的违规举报？管理员核实后将依法处理。', () =>
    run(async () => {
      await post('/reports', { itemId: Number(id), reportType: type.value, reportContent: content.value })
      showReport.value = false
      content.value = ''
      notify('举报工单已提交')
    }),
  )
}
const stateTagClass = (s) => (['gold', 'mint', 'sky', 'ink', 'rose'][s] || '')
</script>
<template>
  <main class="wrap live">
    <header class="page-title"><h1>物品详情</h1></header>
    <LoadState :state="state" v-slot="{ data }">
      <article class="feature">
        <section class="panel stack item-summary" aria-labelledby="item-title">
          <header class="spread">
            <h2 id="item-title">{{ data.title }}</h2>
            <div class="inline">
              <span class="tag" :class="data.tradeMode === 'exchange' ? 'mint' : 'sky'">
                {{ data.tradeMode === 'exchange' ? '以物易物' : '低价寄售' }}
              </span>
              <span class="tag" :class="stateTagClass(data.status)">{{ itemStates[data.status] }}</span>
            </div>
          </header>
          <dl class="item-facts">
            <div class="trade-value full-row">
              <dt>{{ data.tradeMode === 'exchange' ? '期望交换' : '寄售参考价' }}</dt>
              <dd v-if="data.tradeMode === 'exchange'">{{ data.expectItem || '未填写' }}</dd>
              <dd v-else>{{ data.price != null ? '¥' + data.price : '未填写' }}</dd>
            </div>
            <div>
              <dt class="fact-dt"><Sparkles :size="13" :stroke-width="1.8" />成色</dt>
              <dd>{{ data.conditionLevel || '未填写' }}</dd>
            </div>
            <div>
              <dt class="fact-dt"><MapPin :size="13" :stroke-width="1.8" />校区</dt>
              <dd>{{ data.campus || '未填写' }}</dd>
            </div>
            <div class="full-row">
              <dt class="fact-dt"><Navigation :size="13" :stroke-width="1.8" />建议面交点</dt>
              <dd>{{ data.tradePlace || '未填写' }}</dd>
            </div>
            <div class="full-row">
              <dt>物品说明</dt>
              <dd class="description">{{ data.description || '暂无说明' }}</dd>
            </div>
          </dl>
          <div class="actions">
            <RouterLink
              v-if="data.status === 1 && data.ownerId !== user?.userId"
              class="btn primary"
              :to="'/exchange/' + id"
            >
              <component :is="data.tradeMode === 'exchange' ? ArrowLeftRight : ShoppingBag" :size="15" :stroke-width="1.8" />
              <span>{{ data.tradeMode === 'exchange' ? '发起交换' : '发起寄售意向' }}</span>
            </RouterLink>
            <RouterLink
              v-if="data.ownerId === user?.userId && data.status === 1"
              class="btn"
              :to="'/donate/' + id"
            >
              <Gift :size="15" :stroke-width="1.8" />
              <span>捐赠物品</span>
            </RouterLink>
            <RouterLink
              v-if="data.ownerId === user?.userId && [0, 1, 4].includes(data.status)"
              class="btn"
              :to="{ path: '/publish', query: { itemId: id } }"
            >
              <span>编辑物品</span>
            </RouterLink>
            <button :disabled="busy" @click="toggle">
              <Heart :size="15" :stroke-width="1.8" />
              <span>{{ (favorite ?? data.favorited) ? '取消收藏' : '收藏' }}</span>
            </button>
            <button v-if="data.ownerId !== user?.userId" @click="showReport = !showReport">
              <Flag :size="15" :stroke-width="1.8" />
              <span>举报</span>
            </button>
          </div>
          <form v-if="showReport" class="editor" @submit.prevent="report">
            <select v-model="type">
              <option v-for="v in ['虚假描述', '违禁物品', '恶意爽约', '骚扰辱骂']">{{ v }}</option>
            </select>
            <textarea
              v-model.trim="content"
              required
              maxlength="500"
              aria-label="举报说明"
              placeholder="说明举报原因（最多 500 字）"
            ></textarea>
            <button :disabled="busy">提交举报</button>
          </form>
          <p v-if="issue" role="alert" class="error">{{ issue }}</p>
          <footer class="item-publication">
            <dl aria-label="发布信息">
              <div>
                <dt class="fact-dt"><Tag :size="13" :stroke-width="1.8" />分类</dt>
                <dd>{{ data.categoryName || '暂无分类' }}</dd>
              </div>
              <div>
                <dt class="fact-dt"><User :size="13" :stroke-width="1.8" />发布人</dt>
                <dd class="publisher">
                  <span>{{ data.sellerNickname || '暂无昵称' }}</span>
                  <span v-if="data.sellerCreditScore != null" class="tag mint">信用分 {{ data.sellerCreditScore }}</span>
                  <small v-else>信用分暂无记录</small>
                </dd>
              </div>
              <div>
                <dt class="fact-dt"><Clock :size="13" :stroke-width="1.8" />发布时间</dt>
                <dd>{{ data.createTime?.replace('T', ' ') || '暂无记录' }}</dd>
              </div>
              <div>
                <dt class="fact-dt"><Eye :size="13" :stroke-width="1.8" />浏览量</dt>
                <dd>{{ data.viewCount != null ? data.viewCount + ' 次' : '暂无记录' }}</dd>
              </div>
            </dl>
          </footer>
        </section>
        <div class="gallery panel">
          <img
            v-if="photo || data.coverUrl || data.images?.length"
            :src="mediaUrl(photo || data.coverUrl || (data.images[0].imgUrl ?? data.images[0]))"
            :alt="data.title"
          />
          <p v-else class="empty">暂无物品图片</p>
          <div v-if="data.images?.length > 1" class="actions">
            <button v-for="(img, i) in data.images" :key="i" @click="photo = img.imgUrl ?? img">
              图片 {{ i + 1 }}
            </button>
          </div>
        </div>
      </article>
    </LoadState>
  </main>
</template>

<style scoped>
.item-summary {
  align-self: stretch;
}
.item-summary h2 {
  font-size: clamp(20px, 2vw, 26px);
}
.item-summary dl {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 20px;
}
.item-summary dt {
  color: var(--muted);
  font-size: 13px;
}
.fact-dt {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.item-summary dd {
  margin: 2px 0 0;
}
.full-row {
  grid-column: 1 / -1;
}
.trade-value {
  padding: 12px 16px;
  background: var(--pale);
  border-radius: var(--radius);
}
.trade-value dd {
  color: var(--accent);
  font-size: 23px;
  font-weight: 700;
}
.description {
  white-space: pre-line;
}
.item-publication {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--line);
  font-variant-numeric: tabular-nums;
}
.publisher {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}
@media (max-width: 480px) {
  .item-publication dl {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}
</style>
