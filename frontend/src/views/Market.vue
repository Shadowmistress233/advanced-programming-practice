<script setup>
import { ref, reactive, watch, computed } from 'vue'
import { CalendarDays, MapPin, Plus, Sparkles, Users } from '@lucide/vue'
import { get, post, useLoad, useAction, user, campuses, pageOf } from '../api'
import { useRoute, useRouter } from 'vue-router'
import LoadState from '../components/LoadState.vue'
import { confirmAction, notify } from '../feedback'
import Pager from '../components/Pager.vue'
import ItemCard from '../components/ItemCard.vue'

const route = useRoute(),
  id = computed(() => route.params.id),
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
    id.value
      ? get('/activities/' + id.value)
      : get('/activities', { campus: campus.value, status: status.value, page: page.value, pageSize: 12 }),
  [page, campus, status, id],
)

const form = reactive({
  title: '',
  campus: '本部',
  location: '',
  startTime: '',
  endTime: '',
  quota: 1,
  status: 1,
})

function open() {
  if (id.value) {
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
      ...(id.value ? { activityId: Number(id.value) } : {}),
      status: Number(form.status),
      quota: Number(form.quota),
      startTime: form.startTime.replace('T', ' ') + ':00',
      endTime: form.endTime.replace('T', ' ') + ':00',
    })
    edit.value = false
    notify('活动信息已保存')
    if (id.value) await state.reload()
    else router.push('/market/' + data.activityId)
  })
}

function join() {
  confirmAction('确认报名参加集市活动', '报名成功后将扣减 1 个活动名额并生成专属凭证号，确认报名？', () =>
    run(async () => {
      joined.value = await post('/activities/' + id.value + '/join')
      await state.reload()
      notify('活动报名成功')
    }),
  )
}

const featuredActivity = computed(() => {
  const list = state.data.value?.list || []
  return list.find((a) => a.status === 1) || list[0]
})

const quotaPct = (a) => {
  const q = Number(a.quota) || 1
  const used = Math.max(0, q - Number(a.remainQuota ?? 0))
  return Math.round((used / q) * 100)
}
const actStatus = (s) => (['草稿', '报名中', '进行中', '已结束'][s] || '未知')
const actTone = (s) => (['ink', 'mint', 'sky', 'rose'][s] || '')
</script>
<template>
  <main class="wrap live">
    <header class="page-title">
      <h1>校园主题集市</h1>
      <small>MySQL 事务唯一真源防超卖 · 校内广场现场换物与公益专区</small>
    </header>

    <div v-if="!id" class="toolbar">
      <div class="seg-tabs" role="tablist" aria-label="活动状态筛选">
        <button type="button" class="seg-tab" :class="{ active: status === '' }" @click="status = ''">全部活动</button>
        <button type="button" class="seg-tab" :class="{ active: status === '1' }" @click="status = '1'">报名中</button>
        <button type="button" class="seg-tab" :class="{ active: status === '2' }" @click="status = '2'">进行中</button>
        <button type="button" class="seg-tab" :class="{ active: status === '3' }" @click="status = '3'">已结束</button>
      </div>
      <label class="field" style="max-width: 180px">
        <span>举办校区</span>
        <select v-model="campus">
          <option value="">全部校区</option>
          <option v-for="c in campuses" :key="c">{{ c }}</option>
        </select>
      </label>
      <button v-if="manager" class="primary" @click="open">
        <Plus :size="15" />
        <span>新建活动</span>
      </button>
    </div>

    <LoadState :state="state" v-slot="{ data }">
      <template v-if="id">
        <header class="station">
          <div>
            <small>{{ data.campus }} · {{ data.location }} · 主办 {{ data.organizer || '校园社团' }}</small>
            <h1>{{ data.title }}</h1>
            <p>{{ data.startTime }} — {{ data.endTime }}</p>
          </div>
          <div class="stack tight" style="align-items: flex-end">
            <h2>剩余 {{ joined?.remainQuota ?? data.remainQuota }} / {{ data.quota }} 名</h2>
            <button v-if="manager && (user.role === 'admin' || data.creatorId === user.userId)" @click="open">
              编辑活动
            </button>
            <button
              v-else-if="user?.role === 'student'"
              class="primary"
              :disabled="busy || !!joined || data.joined || data.status !== 1 || data.remainQuota <= 0"
              @click="join"
            >
              {{ joined || data.joined ? '已报名' : data.status !== 1 || data.remainQuota <= 0 ? '名额已满/已结束' : '立即报名参加' }}
            </button>
            <p v-if="joined" class="tag gold">报名凭证号 {{ joined.joinNo }}</p>
          </div>
        </header>
        <p class="panel">{{ data.description }}</p>
        <h2>活动专区物品</h2>
        <div class="listing-grid">
          <ItemCard v-for="item in data.items || data.itemList" :key="item.id ?? item.itemId" :item="item" />
        </div>
      </template>

      <template v-else>
        <!-- 精选置顶集市横幅 -->
        <section v-if="featuredActivity" class="market-featured">
          <div class="mf-copy">
            <div class="inline">
              <span class="tag gold"><Sparkles :size="12" /> 近期热门集市</span>
              <span class="tag mint">{{ actStatus(featuredActivity.status) }}</span>
            </div>
            <h2>{{ featuredActivity.title }}</h2>
            <p>{{ featuredActivity.description }}</p>
            <div class="mf-meta">
              <span><MapPin :size="14" /> {{ featuredActivity.campus }} · {{ featuredActivity.location }}</span>
              <span><CalendarDays :size="14" /> {{ featuredActivity.startTime }}</span>
              <span><Users :size="14" /> 剩余名额 {{ featuredActivity.remainQuota }} / {{ featuredActivity.quota }}</span>
            </div>
          </div>
          <div class="mf-action">
            <RouterLink class="btn primary" :to="'/market/' + featuredActivity.activityId">
              <span>{{ featuredActivity.joined ? '已报名 · 查看详情' : '查看专区与报名 →' }}</span>
            </RouterLink>
          </div>
        </section>

        <div class="bulletins">
          <RouterLink
            class="panel bulletin market-card"
            v-for="a in data.list"
            :key="a.activityId ?? a.id"
            :to="'/market/' + (a.activityId ?? a.id)"
          >
            <div class="spread">
              <span class="tag" :class="actTone(a.status)">{{ actStatus(a.status) }}</span>
              <small>{{ a.organizer || '公益社团' }}</small>
            </div>
            <h2>{{ a.title }}</h2>
            <p class="small desc-clip">{{ a.description }}</p>
            <div class="mc-info">
              <small><MapPin :size="12" /> {{ a.campus }} · {{ a.location }}</small>
              <small><CalendarDays :size="12" /> {{ a.startTime }}</small>
            </div>
            <div class="quota-box">
              <div class="spread">
                <small>报名进度</small>
                <b>余 {{ a.remainQuota }} / {{ a.quota }} 名</b>
              </div>
              <div class="quota-track">
                <div class="quota-fill" :style="{ width: quotaPct(a) + '%' }"></div>
              </div>
            </div>
            <div class="spread mc-foot">
              <span class="tag" :class="a.joined ? 'mint' : 'sky'">
                {{ a.joined ? '我已报名' : a.status === 1 ? '可报名参加' : '点击回顾详情' }}
              </span>
              <span class="text" style="color: var(--accent); font-weight: 600">进入活动 →</span>
            </div>
          </RouterLink>
        </div>
        <p v-if="!data.list?.length" class="empty">暂无活动</p>
        <Pager v-if="pageOf(data)?.pages > 1" v-model:page="page" :total="pageOf(data).pages" />
      </template>
    </LoadState>

    <form v-if="edit" class="panel stack" @submit.prevent="save">
      <h2>活动设置</h2>
      <div class="two">
        <label class="field">
          <span>活动名称</span>
          <input v-model="form.title" required maxlength="100" />
        </label>
        <label class="field">
          <span>举办校区</span>
          <select v-model="form.campus" required>
            <option v-for="c in campuses" :key="c">{{ c }}</option>
          </select>
        </label>
        <label class="field">
          <span>活动地点</span>
          <input v-model="form.location" required />
        </label>
        <label class="field">
          <span>活动名额</span>
          <input v-model="form.quota" type="number" min="1" required />
        </label>
        <label class="field">
          <span>开始时间</span>
          <input v-model="form.startTime" type="datetime-local" required />
        </label>
        <label class="field">
          <span>结束时间</span>
          <input v-model="form.endTime" type="datetime-local" :min="form.startTime" required />
        </label>
      </div>
      <label class="field" style="max-width: 240px">
        <span>状态</span>
        <select v-model="form.status">
          <option value="0">草稿</option>
          <option value="1">报名中</option>
          <option value="2">进行中</option>
          <option value="3">已结束</option>
        </select>
      </label>
      <button class="primary" :disabled="busy" style="justify-self: start">保存活动</button>
    </form>
    <p v-if="issue" role="alert" class="error">{{ issue }}</p>
  </main>
</template>

<style scoped>
.market-featured {
  background: #303e82;
  color: #ffffff;
  border-radius: 10px;
  padding: 22px 26px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.mf-copy {
  flex: 1 1 500px;
  display: grid;
  gap: 8px;
}
.mf-copy h2 {
  font-size: 22px;
}
.mf-copy p {
  color: #dce2f8;
  font-size: 13.5px;
}
.mf-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 13px;
  color: #eef1fc;
}
.mf-meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.mf-action .primary {
  background: #f7ce7d;
  border-color: #f7ce7d;
  color: #24253d;
  font-weight: 700;
}
.market-card {
  gap: 10px;
}
.desc-clip {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 36px;
}
.mc-info {
  display: grid;
  gap: 4px;
}
.mc-info small {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.quota-box {
  display: grid;
  gap: 5px;
  font-size: 12.5px;
}
.quota-track {
  height: 6px;
  border-radius: 99px;
  background: #eceae2;
  overflow: hidden;
}
.quota-fill {
  height: 100%;
  border-radius: 99px;
  background: #0f8a6a;
}
.mc-foot {
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}
</style>
