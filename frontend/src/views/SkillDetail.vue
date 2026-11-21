<script setup>
import { ref, reactive } from 'vue'
import { get, post, useLoad, useAction, user } from '../api'
import { useRoute } from 'vue-router'
import LoadState from '../components/LoadState.vue'
import { notify, confirmAction } from '../feedback'
const id = useRoute().params.id,
  message = ref(''),
  edit = ref(false),
  form = reactive({})
const state = useLoad(async () => {
  const d = await get('/skills/' + id)
  Object.assign(form, {
    skillId: Number(id),
    skillName: d.skillName,
    skillType: d.skillType,
    level: d.level,
    description: d.description,
    expectSkill: d.expectSkill,
    status: d.status,
  })
  return d
})
const { busy, issue, run } = useAction()
function invite() {
  run(async () => {
    await post('/skills/' + id + '/invites', { message: message.value })
    notify('互换邀约已发送')
  })
}
function save(status) {
  run(async () => {
    await post('/skills', { ...form, status })
    edit.value = false
    await state.reload()
  })
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title"><h1>技能详情</h1></header>
    <LoadState :state="state" v-slot="{ data }">
      <article class="panel editor">
        <small>{{ data.level }} · {{ data.skillType === 1 ? '能提供' : '正在找' }}</small>
        <h1>{{ data.skillName }}</h1>
        <p>{{ data.description }}</p>
        <p>希望交换 · {{ data.expectSkill }}</p>
        <span v-if="data.complementary" class="tag mint">技能互补</span>
        <template v-if="data.userId === user?.userId">
          <div class="actions">
            <button @click="edit = !edit">编辑技能</button>
            <button
              v-if="data.status === 1"
              :disabled="busy"
              @click="confirmAction('关闭技能', '关闭后将停止接收邀约', () => save(0))"
            >
              关闭技能
            </button>
          </div>
          <form v-if="edit" @submit.prevent="save(form.status)" class="editor">
            <label class="field">
              <span>技能名称</span>
              <input v-model="form.skillName" required maxlength="50" />
            </label>
            <label class="field">
              <span>方向</span>
              <select v-model="form.skillType">
                <option :value="1">能提供</option>
                <option :value="2">正在找</option>
              </select>
            </label>
            <label class="field">
              <span>熟练度</span>
              <select v-model="form.level">
                <option value="入门">入门</option>
                <option value="熟练">熟练</option>
                <option value="精通">精通</option>
              </select>
            </label>
            <label class="field">
              <span>希望交换</span>
              <input v-model="form.expectSkill" required />
            </label>
            <label class="field">
              <span>服务说明</span>
              <input v-model="form.description" />
            </label>
            <button class="primary" :disabled="busy">保存</button>
          </form>
        </template>
        <form v-else-if="data.status !== 0" @submit.prevent="invite" class="editor">
          <label class="field">
            <span>邀约留言</span>
            <input v-model="message" maxlength="200" />
          </label>
          <button class="primary" :disabled="busy">发送互换邀约</button>
        </form>
        <p v-if="issue" role="alert" class="error">{{ issue }}</p>
      </article>
    </LoadState>
  </main>
</template>
