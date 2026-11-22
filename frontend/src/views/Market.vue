<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { get, post, useLoad, useAction, user, campuses, pageOf } from '../api'
import { useRoute, useRouter } from 'vue-router'
import LoadState from '../components/LoadState.vue'
import { notify } from '../feedback'
import Pager from '../components/Pager.vue'
import ItemCard from '../components/ItemCard.vue'
const id = useRoute().params.id,
  router = useRouter(),
  page = ref(1),
  campus = ref(''),
  status = ref(''),
  edit = ref(false),
  joined = ref(null)
const manager = computed(() => ['club', 'admin'].includes(user.value?.role))
watch([campus, status], () => (page.value = 1))
const state = useLoad(
  () =>
    id
      ? get('/activities/' + id)
      : get('/activities', { campus: campus.value, status: status.value, page: page.value, pageSize: 12 }),
  [page, campus, status],
)
const form = reactive({
  title: '',
  campus: '',
  location: '',
  startTime: '',
  endTime: '',
  quota: 1,
  status: 1,
})
function open() {
  if (id) {
    for (const k in form) form[k] = state.data.value[k]
    for (const k of ['startTime', 'endTime']) form[k] = form[k]?.replace(' ', 'T').slice(0, 16)
  }
  edit.value = true
}
const { busy, issue, run } = useAction()
function save() {
  run(async () => {
    const data = await post('/activities', {
      ...form,
      ...(id ? { activityId: Number(id) } : {}),
      status: Number(form.status),
      quota: Number(form.quota),
      startTime: form.startTime.replace('T', ' ') + ':00',
      endTime: form.endTime.replace('T', ' ') + ':00',
    })
    edit.value = false
    if (id) await state.reload()
    else router.push('/market/' + data.activityId)
  })
}
function join() {
  run(async () => {
    joined.value = await post('/activities/' + id + '/join')
    await state.reload()
    notify('报名成功')
  })
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title"><h1>校园主题集市</h1></header>
    <div v-if="!id" class="toolbar">
      <label class="field">
        <span>举办校区</span>
        <select v-model="campus">
          <option value="">全部</option>
          <option v-for="c in campuses">{{ c }}</option>
        </select>
      </label>
      <label class="field">
        <span>活动状态</span>
        <select v-model="status">
          <option value="1">报名中</option>
          <option value="2">进行中</option>
          <option value="3">已结束</option>
          <option value="">全部</option>
        </select>
      </label>
      <button v-if="manager" @click="open">新建活动</button>
    </div>
    <LoadState :state="state" v-slot="{ data }">
      <template v-if="id">
        <header class="station">
          <div>
            <small>{{ data.campus }} · {{ data.location }}</small>
            <h1>{{ data.title }}</h1>
            <p>{{ data.startTime }} — {{ data.endTime }}</p>
          </div>
          <div>
            <h2>剩余 {{ joined?.remainQuota ?? data.remainQuota }} 名</h2>
            <button v-if="manager && (user.role === 'admin' || data.creatorId === user.userId)" @click="open">
              编辑活动
            </button>
            <button
              v-else-if="user?.role === 'student'"
              :disabled="busy || !!joined || data.joined || data.status !== 1 || data.remainQuota <= 0"
              @click="join"
            >
              {{ joined || data.joined ? '已报名' : '报名参加' }}
            </button>
            <p v-if="joined">报名号 {{ joined.joinNo }}</p>
          </div>
        </header>
        <p>{{ data.description }}</p>
        <h2>活动专区物品</h2>
        <div class="listing-grid">
          <ItemCard v-for="item in data.items || data.itemList" :key="item.id ?? item.itemId" :item="item" />
        </div>
      </template>
      <template v-else>
        <div class="bulletins">
          <RouterLink class="panel bulletin" v-for="a in data.list" :to="'/market/' + (a.activityId ?? a.id)">
            <small>{{ a.campus }} · {{ a.startTime }}</small>
            <h2>{{ a.title }}</h2>
            <p>{{ a.location }} · 余 {{ a.remainQuota }} 名</p>
          </RouterLink>
        </div>
        <p v-if="!data.list?.length" class="empty">暂无活动</p>
        <Pager v-if="pageOf(data)?.pages > 1" v-model:page="page" :total="pageOf(data).pages" />
      </template>
    </LoadState>
    <form v-if="edit" class="editor panel" @submit.prevent="save">
      <h2>活动设置</h2>
      <label class="field">
        <span>名称</span>
        <input v-model="form.title" required maxlength="100" />
      </label>
      <label class="field">
        <span>校区</span>
        <select v-model="form.campus" required>
          <option v-for="c in campuses">{{ c }}</option>
        </select>
      </label>
      <label class="field">
        <span>地点</span>
        <input v-model="form.location" required />
      </label>
      <label class="field">
        <span>开始时间</span>
        <input v-model="form.startTime" type="datetime-local" required />
      </label>
      <label class="field">
        <span>结束时间</span>
        <input v-model="form.endTime" type="datetime-local" :min="form.startTime" required />
      </label>
      <label class="field">
        <span>名额</span>
        <input v-model="form.quota" type="number" min="1" required />
      </label>
      <label class="field">
        <span>状态</span>
        <select v-model="form.status">
          <option value="0">草稿</option>
          <option value="1">报名中</option>
          <option value="2">进行中</option>
          <option value="3">已结束</option>
        </select>
      </label>
      <button class="primary" :disabled="busy">保存活动</button>
    </form>
    <p v-if="issue" role="alert" class="error">{{ issue }}</p>
  </main>
</template>
