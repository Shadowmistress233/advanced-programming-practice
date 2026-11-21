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
        <section class="panel stack">
          <small>{{ data.campus }} · {{ data.conditionLevel }} · {{ itemStates[data.status] }}</small>
          <h1>{{ data.title }}</h1>
          <h2>{{ data.tradeMode === 'exchange' ? '想换 ' + data.expectItem : '¥' + data.price }}</h2>
          <p>{{ data.description }}</p>
          <p v-if="data.tradePlace">建议面交点 · {{ data.tradePlace }}</p>
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
