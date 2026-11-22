<script setup>
import { ref, reactive } from 'vue'
import { MapPin, MessageSquarePlus, ShieldCheck, Sparkles, User } from '@lucide/vue'
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
  confirmAction('发送技能互换邀约', '提交后将通过站内通知发送给对方，双方线下沟通完成互换。', () =>
    run(async () => {
      await post('/skills/' + id + '/invites', { message: message.value })
      message.value = ''
      notify('互换邀约已发送至对方站内信')
    }),
  )
}
function save(status) {
  run(async () => {
    await post('/skills', { ...form, status })
    edit.value = false
    notify(status === 0 ? '技能已关闭' : '技能信息已保存')
    await state.reload()
  })
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title">
      <h1>技能详情</h1>
      <small>站内精准匹配互补技能 · 线下面对面互换不产生订单锁定</small>
    </header>
    <LoadState :state="state" v-slot="{ data }">
      <div class="split-desk">
        <article class="panel stack">
          <div class="spread">
            <div class="inline">
              <span class="tag" :class="data.skillType === 1 ? 'mint' : 'sky'">
                {{ data.skillType === 1 ? '能提供' : '正在找' }}
              </span>
              <span class="tag">{{ data.level }}</span>
              <span class="tag" :class="data.status === 1 ? 'mint' : 'ink'">
                {{ data.status === 1 ? '开放邀约中' : '已关闭' }}
              </span>
            </div>
            <span v-if="data.complementary || data.matchTags?.length" class="tag mint" style="gap: 4px">
              <Sparkles :size="12" />
              <span>高度互补</span>
            </span>
          </div>

          <h2>{{ data.skillName }}</h2>
          <div class="expect-banner">
            <small>期望交换技能</small>
            <b>{{ data.expectSkill || '校内互助技能沟通' }}</b>
          </div>
          <p class="desc">{{ data.description }}</p>

          <div v-if="data.complementary" class="comp-callout">
            <Sparkles :size="16" />
            <div>
              <b>{{ data.complementary }}</b>
              <small v-if="data.matchTags?.length">匹配交集标签：{{ data.matchTags.join('、') }}</small>
            </div>
          </div>

          <template v-if="data.userId === user?.userId">
            <div class="actions">
              <button @click="edit = !edit">{{ edit ? '收起编辑' : '编辑技能' }}</button>
              <button
                v-if="data.status === 1"
                class="danger"
                :disabled="busy"
                @click="confirmAction('关闭技能', '关闭后将释放该方向名额并停止接收邀约，确认继续？', () => save(0))"
              >
                关闭技能
              </button>
            </div>
            <form v-if="edit" @submit.prevent="save(form.status)" class="stack">
              <label class="field">
                <span>技能名称</span>
                <input v-model="form.skillName" required maxlength="50" />
              </label>
              <label class="field">
                <span>方向（发布后不可更改）</span>
                <select v-model="form.skillType" disabled>
                  <option :value="1">我能提供</option>
                  <option :value="2">我需要</option>
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
                <input v-model="form.expectSkill" required maxlength="100" />
              </label>
              <label class="field">
                <span>服务说明</span>
                <textarea v-model="form.description" rows="2" maxlength="500" />
              </label>
              <button class="primary" :disabled="busy">保存修改</button>
            </form>
          </template>

          <form v-else-if="data.status !== 0" @submit.prevent="invite" class="stack invite-box">
            <label class="field">
              <span>邀约留言（说明你的擅长技能与空闲时段）</span>
              <textarea
                v-model="message"
                rows="3"
                required
                maxlength="200"
                placeholder="例如：我已修完高数且时间充足，希望每周周三下午和你对练雅思口语！"
              />
            </label>
            <div class="actions">
              <button class="primary" :disabled="busy">
                <MessageSquarePlus :size="15" />
                <span>发送互换邀约</span>
              </button>
              <RouterLink class="btn" to="/skills">返回技能大厅</RouterLink>
            </div>
          </form>
          <p v-if="issue" role="alert" class="error">{{ issue }}</p>
        </article>

        <aside class="stack">
          <section class="panel stack">
            <h3>发布人信用档案</h3>
            <div class="pub-row">
              <span class="avatar">{{ (data.publisherName || '同')[0] }}</span>
              <div>
                <b>{{ data.publisherName || '校内同学' }}</b>
                <small><MapPin :size="12" /> {{ data.campus || '本部' }} · 已完成校园实名认证</small>
              </div>
              <span class="tag mint" style="margin-left: auto">
                <ShieldCheck :size="12" /> 信用 {{ data.publisherCredit ?? 96 }}
              </span>
            </div>
          </section>

          <section class="panel tinted stack">
            <h3>技能互换约定</h3>
            <ul class="rule-list">
              <li><b>单向限额：</b>每人同方向最多保留 3 条有效技能；关闭后即时释放名额。</li>
              <li><b>站内防扰：</b>不允许向本人发起邀约；关闭态技能禁止发起新邀约。</li>
              <li><b>线下互助：</b>技能互换不生成物品流转单，不参与线上核销与积分增减。</li>
            </ul>
          </section>
        </aside>
      </div>
    </LoadState>
  </main>
</template>

<style scoped>
.expect-banner {
  padding: 12px 16px;
  border-radius: 9px;
  background: var(--pale);
  display: grid;
  gap: 2px;
}
.expect-banner b {
  font-size: 17px;
  color: #303e82;
}
.desc {
  line-height: 1.65;
  color: #394052;
}
.comp-callout {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 9px;
  background: #e6f6f0;
  color: #0f8a6a;
}
.comp-callout b {
  display: block;
}
.invite-box {
  padding-top: 12px;
  border-top: 1px solid var(--line);
}
.pub-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.pub-row b {
  display: block;
}
.pub-row small {
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
</style>
