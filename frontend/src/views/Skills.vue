<script setup>
import { ref, reactive, watch } from 'vue'
import { get, post, useLoad, useAction, user, pageOf } from '../api'
import { useRouter } from 'vue-router'
import LoadState from '../components/LoadState.vue'
import Pager from '../components/Pager.vue'
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
    router.push('/skill/' + data.skillId)
  })
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title"><h1>技能交换</h1></header>
    <div class="toolbar">
      <label class="field">
        <span>搜索技能</span>
        <input v-model="keyword" type="search" />
      </label>
      <label class="field">
        <span>技能方向</span>
        <select v-model="skillType">
          <option value="1">我能提供</option>
          <option value="2">我需要</option>
          <option value="">全部</option>
        </select>
      </label>
      <label class="field">
        <span>熟练度</span>
        <select v-model="level">
          <option value="">全部</option>
          <option value="入门">入门</option>
          <option value="熟练">熟练</option>
          <option value="精通">精通</option>
        </select>
      </label>
      <button v-if="user?.role === 'student'" @click="show = !show">发布技能</button>
    </div>
    <form v-if="show" class="editor panel" @submit.prevent="save">
      <label class="field">
        <span>技能名称</span>
        <input v-model="form.skillName" required maxlength="50" />
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
        <input v-model="form.expectSkill" required maxlength="100" />
      </label>
      <label class="field">
        <span>服务说明</span>
        <input v-model="form.description" maxlength="500" />
      </label>
      <p v-if="issue" role="alert" class="error">{{ issue }}</p>
      <button class="primary" :disabled="busy">发布</button>
    </form>
    <LoadState :state="state" v-slot="{ data }">
      <div class="bulletins">
        <RouterLink v-for="s in data.list" class="panel bulletin" :to="'/skill/' + (s.skillId ?? s.id)">
          <small>{{ Number(s.skillType) === 1 ? '能提供' : '正在找' }} · {{ s.level }}</small>
          <h2>{{ s.skillName }}</h2>
          <p>希望交换 · {{ s.expectSkill }}</p>
        </RouterLink>
      </div>
      <p v-if="!data.list?.length" class="empty">暂无匹配的技能</p>
      <Pager v-if="pageOf(data)?.pages > 1" v-model:page="page" :total="pageOf(data).pages" />
    </LoadState>
  </main>
</template>
