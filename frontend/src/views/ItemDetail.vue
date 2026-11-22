<script setup>
import { ref } from 'vue'
import { get, post, useLoad, useAction, user, mediaUrl, itemStates } from '../api'
import { useRoute } from 'vue-router'
import LoadState from '../components/LoadState.vue'
import { notify } from '../feedback'
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
  })
}
function report() {
  run(async () => {
    await post('/reports', { itemId: Number(id), reportType: type.value, reportContent: content.value })
    showReport.value = false
    notify('举报已提交')
  })
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title"><h1>物品详情</h1></header>
    <LoadState :state="state" v-slot="{ data }">
      <article class="feature">
        <section class="panel stack item-summary" aria-labelledby="item-title">
          <header class="spread">
            <h2 id="item-title">{{ data.title }}</h2>
            <span class="tag" :class="{ mint: data.status === 1 }">{{ itemStates[data.status] }}</span>
          </header>
          <dl class="item-facts">
            <div class="trade-value full-row">
              <dt>{{ data.tradeMode === 'exchange' ? '期望交换' : '价格' }}</dt>
              <dd v-if="data.tradeMode === 'exchange'">{{ data.expectItem || '未填写' }}</dd>
              <dd v-else>{{ data.price != null ? '¥' + data.price : '未填写' }}</dd>
            </div>
            <div><dt>成色</dt><dd>{{ data.conditionLevel || '未填写' }}</dd></div>
            <div><dt>校区</dt><dd>{{ data.campus || '未填写' }}</dd></div>
            <div class="full-row"><dt>建议面交点</dt><dd>{{ data.tradePlace || '未填写' }}</dd></div>
            <div class="full-row"><dt>物品说明</dt><dd class="description">{{ data.description || '暂无说明' }}</dd></div>
          </dl>
          <div class="actions">
            <RouterLink
              v-if="data.status === 1 && data.ownerId !== user?.userId"
              class="btn primary"
              :to="'/exchange/' + id"
            >
              {{ data.tradeMode === 'exchange' ? '发起交换' : '发起寄售意向' }}
            </RouterLink>
            <RouterLink
              v-if="data.ownerId === user?.userId && data.status === 1"
              class="btn"
              :to="'/donate/' + id"
            >
              捐赠物品
            </RouterLink>
            <button :disabled="busy" @click="toggle">
              {{ (favorite ?? data.favorited) ? '取消收藏' : '收藏' }}
            </button>
            <button @click="showReport = !showReport">举报</button>
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
              placeholder="说明举报原因"
            ></textarea>
            <button :disabled="busy">提交举报</button>
          </form>
          <p v-if="issue" role="alert" class="error">{{ issue }}</p>
          <footer class="item-publication">
            <dl aria-label="发布信息">
              <div><dt>分类</dt><dd>{{ data.categoryName || '暂无分类' }}</dd></div>
              <div>
                <dt>发布人</dt>
                <dd class="publisher">
                  <span>{{ data.sellerNickname || '暂无昵称' }}</span>
                  <span v-if="data.sellerCreditScore != null" class="tag sky">信用分 {{ data.sellerCreditScore }}</span>
                  <small v-else>信用分暂无记录</small>
                </dd>
              </div>
              <div><dt>发布时间</dt><dd>{{ data.createTime?.replace('T', ' ') || '暂无记录' }}</dd></div>
              <div><dt>浏览量</dt><dd>{{ data.viewCount != null ? data.viewCount + ' 次' : '暂无记录' }}</dd></div>
            </dl>
          </footer>
        </section>
        <div class="gallery panel">
          <img
            v-if="photo || data.coverUrl || data.images?.length"
            :src="mediaUrl(photo || data.coverUrl || (data.images[0].imgUrl ?? data.images[0]))"
            :alt="data.title"
          />
          <p v-else>暂无物品图片</p>
          <div class="actions">
            <button v-for="(img, i) in data.images" @click="photo = img.imgUrl ?? img">
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
  font-size: clamp(21px, 2vw, 28px);
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
  .item-publication dl > div {
    display: grid;
    grid-template-columns: 5em minmax(0, 1fr);
    align-items: baseline;
  }
}
</style>
