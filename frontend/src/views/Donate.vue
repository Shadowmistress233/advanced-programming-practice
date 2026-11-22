<script setup>
import { ref } from 'vue'
import { Award, CheckCircle2, Gift, HeartHandshake, MapPin, Package, ShieldCheck } from '@lucide/vue'
import { get, post, useLoad, useAction, user, charityClubs, mediaUrl } from '../api'
import { useRoute, useRouter } from 'vue-router'
import LoadState from '../components/LoadState.vue'
import { confirmAction, notify } from '../feedback'

const id = useRoute().params.id,
  router = useRouter(),
  clubId = ref(charityClubs[0].clubId),
  remark = ref('')
const state = useLoad(() => get('/items/' + id)),
  { busy, issue, run } = useAction()

function save() {
  const club = charityClubs.find((c) => c.clubId === Number(clubId.value))
  confirmAction(
    '确认提交公益快捐',
    `拟捐赠至「${club?.clubName || '公益社团'}」。提交后该物品将立即锁定并停止交易流转，等待社团审核入库。`,
    () =>
      run(async () => {
        await post('/donations', { itemId: Number(id), clubId: Number(clubId.value), remark: remark.value })
        notify('快捐申请已提交，等待社团审核')
        router.push('/donations')
      }),
  )
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title">
      <h1>捐赠申请</h1>
      <small>一键捐赠本人闲置给校内公益社团 · 审核入库后签发防伪电子凭证并奖励 +5 信用分</small>
    </header>
    <LoadState :state="state" v-slot="{ data }">
      <form
        v-if="data.status === 1 && data.ownerId === user?.userId"
        class="split-desk"
        @submit.prevent="save"
      >
        <section class="panel stack">
          <div class="spread">
            <h2>选择接收公益社团</h2>
            <span class="tag violet">校内公益定向接收</span>
          </div>

          <div class="club-grid">
            <button
              v-for="c in charityClubs"
              :key="c.clubId"
              type="button"
              class="choice club-card"
              :class="{ selected: clubId === c.clubId }"
              @click="clubId = c.clubId"
            >
              <div class="spread">
                <b><HeartHandshake :size="15" /> {{ c.clubName }}</b>
                <span class="tag" :class="clubId === c.clubId ? 'violet' : ''">{{ c.campus }}</span>
              </div>
              <small>{{ c.desc }}</small>
            </button>
          </div>

          <label class="field">
            <span>捐赠用途与实物说明（可选，最多 255 字）</span>
            <textarea
              v-model="remark"
              rows="3"
              maxlength="255"
              placeholder="例如：配件完整可正常使用，希望转赠给需要的低年级同学。"
            />
          </label>
          <p v-if="issue" role="alert" class="error">{{ issue }}</p>
          <div class="actions">
            <button class="primary" :disabled="busy">
              <Gift :size="15" />
              <span>提交快捐申请</span>
            </button>
            <RouterLink class="btn" :to="'/item/' + id">返回物品详情</RouterLink>
          </div>
        </section>

        <aside class="stack">
          <section class="panel stack">
            <h3>待捐闲置物品</h3>
            <div class="target-preview">
              <div class="target-cover">
                <img v-if="data.coverUrl" :src="mediaUrl(data.coverUrl)" :alt="data.title" />
                <Package v-else :size="26" />
              </div>
              <div class="stack tight">
                <b>{{ data.title }}</b>
                <small>{{ data.categoryName }} · {{ data.conditionLevel }}</small>
                <small><MapPin :size="12" /> {{ data.campus }} · {{ data.tradePlace }}</small>
                <span class="tag mint">本人当前在售</span>
              </div>
            </div>
          </section>

          <section class="panel tinted stack">
            <h3><Award :size="15" /> 公益快捐闭环说明</h3>
            <ul class="rule-list">
              <li><CheckCircle2 :size="14" /><span><b>提交锁定：</b>申请发出后物品立即置为锁定状态，防止重复售卖。</span></li>
              <li><CheckCircle2 :size="14" /><span><b>社团审核：</b>接收社团在工作台核验入库（如不通过将即时解锁回在售）。</span></li>
              <li><ShieldCheck :size="14" /><span><b>凭证与加分：</b>审核通过后自动生成唯一防伪 CLD 电子凭证，并奖励 <b>+5 信用分</b>。</span></li>
            </ul>
          </section>
        </aside>
      </form>
      <p v-else class="panel">只能捐赠本人在售的物品。</p>
    </LoadState>
  </main>
</template>

<style scoped>
.club-grid {
  display: grid;
  gap: 12px;
}
.club-card {
  border-radius: 10px;
  padding: 14px 16px;
}
.club-card b {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
}
.target-preview {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
.target-cover {
  width: 92px;
  height: 92px;
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
.target-preview small {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.rule-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 9px;
  font-size: 13px;
  color: #384056;
}
.rule-list li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.rule-list li .lucide {
  margin-top: 3px;
  color: #7c3aed;
}
h3 {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
