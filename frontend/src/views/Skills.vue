<script setup>
import { ref, reactive, watch } from 'vue'
import { MapPin, Plus, ShieldCheck, Sparkles, User } from '@lucide/vue'
import { get, post, useLoad, useAction, user, pageOf } from '../api'
import { useRouter } from 'vue-router'
import LoadState from '../components/LoadState.vue'
import Pager from '../components/Pager.vue'
import { notify } from '../feedback'

const router = useRouter(),
  keyword = ref(''),
  level = ref(''),
  skillType = ref(''),
  page = ref(1),
  show = ref(false)
watch([keyword, level, skillType], () => (page.value = 1))
const state = useLoad(
  () =>
    get('/skills', {
      keyword: keyword.value,
      level: level.value,
      skillType: skillType.value,
      page: page.value,
      pageSize: 12,
    }),
  [keyword, level, skillType, page],
)
const form = reactive({
  skillName: '',
  skillType: 1,
  level: '熟练',
  expectSkill: '',
  description: '',
  status: 1,
})
const { busy, issue, run } = useAction()
function save() {
  run(async () => {
    const data = await post('/skills', { ...form, skillType: Number(form.skillType) })
    notify('技能发布成功')
    router.push('/skill/' + data.skillId)
  })
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title">
      <h1>技能交换</h1>
      <small>校内同学技能互补互助 · 每位同学同方向最多保留 3 条有效技能</small>
    </header>
    <div class="toolbar">
      <div class="seg-tabs" role="tablist" aria-label="技能方向筛选">
        <button type="button" class="seg-tab" :class="{ active: skillType === '' }" @click="skillType = ''">
          全部方向
        </button>
        <button type="button" class="seg-tab" :class="{ active: skillType === 1 }" @click="skillType = 1">
          我能提供
        </button>
        <button type="button" class="seg-tab" :class="{ active: skillType === 2 }" @click="skillType = 2">
          我需要
        </button>
      </div>
      <label class="field">
        <span>搜索技能</span>
        <input v-model="keyword" type="search" placeholder="输入课程、软件、乐器或技能关键词" />
      </label>
      <label class="field" style="max-width: 150px">
        <span>熟练度</span>
        <select v-model="level">
          <option value="">全部</option>
          <option value="入门">入门</option>
          <option value="熟练">熟练</option>
          <option value="精通">精通</option>
        </select>
      </label>
      <button v-if="user?.role === 'student'" class="primary" @click="show = !show">
        <Plus :size="15" />
        <span>{{ show ? '收起表单' : '发布技能' }}</span>
      </button>
    </div>

    <form v-if="show" class="panel stack" @submit.prevent="save">
      <div class="spread">
        <h3>发布技能提供 / 需求</h3>
        <small>提示：同类有效技能上限 3 条，发布后方向不可修改</small>
      </div>
      <div class="skill-form-grid">
        <label class="field">
          <span>技能名称</span>
          <input v-model="form.skillName" required maxlength="50" placeholder="如：Python 数据处理辅导" />
        </label>
        <label class="field">
          <span>方向</span>
          <select v-model="form.skillType">
            <option value="1">我能提供</option>
            <option value="2">我需要</option>
          </select>
        </label>
        <label class="field">
          <span>熟练程度</span>
          <select v-model="form.level">
            <option value="入门">入门</option>
            <option value="熟练">熟练</option>
            <option value="精通">精通</option>
          </select>
        </label>
        <label class="field">
          <span>希望交换</span>
          <input v-model="form.expectSkill" required maxlength="100" placeholder="如：英语四六级口语陪练" />
        </label>
      </div>
      <label class="field">
        <span>服务说明</span>
        <input v-model="form.description" maxlength="500" placeholder="说明辅导形式、空余时间或基础情况…" />
      </label>
      <p v-if="issue" role="alert" class="error">{{ issue }}</p>
      <div class="actions">
        <button class="primary" :disabled="busy">确认发布</button>
      </div>
    </form>

    <LoadState :state="state" v-slot="{ data }">
      <div class="bulletins">
        <RouterLink
          v-for="s in data.list"
          :key="s.skillId ?? s.id"
          class="panel bulletin skill-card"
          :to="'/skill/' + (s.skillId ?? s.id)"
        >
          <div class="spread">
            <div class="inline">
              <span class="tag" :class="Number(s.skillType) === 1 ? 'mint' : 'sky'">
                {{ Number(s.skillType) === 1 ? '能提供' : '正在找' }}
              </span>
              <span class="tag">{{ s.level }}</span>
            </div>
            <span v-if="s.complementary || s.matchTags?.length" class="tag mint comp-badge">
              <Sparkles :size="11" />
              <span>高度互补</span>
            </span>
          </div>
          <h2>{{ s.skillName }}</h2>
          <p class="expect-line">希望交换 · {{ s.expectSkill || '校内互助沟通' }}</p>
          <p class="small desc-line">{{ s.description }}</p>
          <div class="skill-foot">
            <span><User :size="12" /> {{ s.publisherName || '校内同学' }}</span>
            <span><MapPin :size="12" /> {{ s.campus || '本部' }}</span>
            <span class="tag sky"><ShieldCheck :size="11" /> 信用 {{ s.publisherCredit ?? 90 }}</span>
          </div>
        </RouterLink>
      </div>
      <p v-if="!data.list?.length" class="empty">暂无匹配的技能</p>
      <Pager v-if="pageOf(data)?.pages > 1" v-model:page="page" :total="pageOf(data).pages" />
    </LoadState>
  </main>
</template>

<style scoped>
.skill-form-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.skill-card {
  gap: 10px;
}
.comp-badge {
  gap: 4px;
  font-weight: 600;
}
.expect-line {
  font-weight: 600;
  color: #303e82;
}
.desc-line {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 36px;
}
.skill-foot {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  color: var(--muted);
}
.skill-foot > span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.skill-foot .tag {
  margin-left: auto;
}
@media (max-width: 900px) {
  .skill-form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
