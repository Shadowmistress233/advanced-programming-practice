<script setup>
import { computed, ref, watch } from 'vue'
import { CheckSquare, ClipboardCheck, FileCheck2, HeartHandshake, Package, ShieldCheck } from '@lucide/vue'
import { get, post, useAction, useLoad, user, pageOf, campuses, categoryOptions, mediaUrl } from '../api'
import { useRoute } from 'vue-router'
import LoadState from '../components/LoadState.vue'
import { notify, confirmAction } from '../feedback'
import Pager from '../components/Pager.vue'

const route = useRoute(),
  goods = computed(() => route.path === '/admin/review'),
  isClubDesk = computed(() => route.path === '/club'),
  page = ref(1),
  auditStatus = ref(''),
  campus = ref(''),
  categoryId = ref('')
const categories = useLoad(() => (goods.value ? get('/categories/tree') : []))
const checked = ref([]),
  current = ref(null),
  pass = ref(true),
  reason = ref('')

watch([auditStatus, campus, categoryId], () => (page.value = 1))
const state = useLoad(
  () =>
    goods.value
      ? get('/admin/items/pending', {
          campus: campus.value,
          categoryId: categoryId.value,
          page: page.value,
          pageSize: 12,
        })
      : get('/donations', { auditStatus: auditStatus.value, page: page.value, pageSize: 12 }),
  [page, campus, categoryId, auditStatus, goods],
)
watch([page, campus, categoryId, auditStatus], () => {
  checked.value = []
  current.value = null
})

const clubStats = computed(() => {
  const list = state.data.value?.list || []
  return {
    pending: list.filter((r) => r.auditStatus === 0).length,
    approved: list.filter((r) => r.auditStatus === 1).length,
    rejected: list.filter((r) => r.auditStatus === 2).length,
  }
})

const { busy, issue, run } = useAction()
function toggleAll(list) {
  const allIds = (list || []).map((r) => r.itemId ?? r.id)
  if (checked.value.length === allIds.length) checked.value = []
  else checked.value = allIds
}
function audit() {
  const ids = goods.value ? [...checked.value] : [current.value]
  const allowed = pass.value,
    msg = reason.value
  confirmAction(allowed ? '确认通过审核' : '确认驳回申请', '本次将处理 ' + ids.length + ' 条记录。', () =>
    run(async () => {
      if (goods.value) await post('/admin/items/audit', { itemIds: ids, pass: allowed, reason: msg })
      else await post('/donations/' + ids[0] + '/audit', { pass: allowed, auditRemark: msg })
      checked.value = []
      current.value = null
      reason.value = ''
      await state.reload()
      notify('审核已完成')
    }),
  )
}
const auditTone = (s) => (['gold', 'mint', 'rose'][s] || '')
</script>
<template>
  <main class="wrap live">
    <header class="page-title">
      <h1>{{ goods ? '物品审核' : isClubDesk ? '捐赠审核台' : '我的捐赠' }}</h1>
      <small v-if="goods">支持批量通过或填写原因驳回，审核结果经 AOP 操作日志自动留痕</small>
      <small v-else-if="isClubDesk">社团数据隔离加载 · 通过后自动生成 CLD 唯一防伪凭证并奖励捐赠人 +5 信用分</small>
      <small v-else>查看已提交的公益捐赠审批进度与电子捐赠凭证</small>
    </header>

    <div v-if="!goods && isClubDesk && state.data.value" class="three club-stats">
      <div class="panel stat-pill">
        <small>当前页待审核</small>
        <b style="color: #b45309">{{ clubStats.pending }} 件</b>
      </div>
      <div class="panel stat-pill">
        <small>已审核入库发证</small>
        <b style="color: #0f8a6a">{{ clubStats.approved }} 件</b>
      </div>
      <div class="panel stat-pill">
        <small>已驳回解锁</small>
        <b style="color: #dc2626">{{ clubStats.rejected }} 件</b>
      </div>
    </div>

    <div class="toolbar">
      <template v-if="goods">
        <label class="field">
          <span>校区</span>
          <select v-model="campus">
            <option value="">全部</option>
            <option v-for="c in campuses" :key="c">{{ c }}</option>
          </select>
        </label>
        <label class="field">
          <span>分类</span>
          <select v-model="categoryId">
            <option value="">全部</option>
            <option v-for="c in categoryOptions(categories.data.value)" :key="c.id" :value="c.id">
              {{ c.categoryName }}
            </option>
          </select>
        </label>
        <button
          v-if="state.data.value?.list?.length"
          type="button"
          @click="toggleAll(state.data.value.list)"
        >
          <CheckSquare :size="15" />
          <span>{{ checked.length === state.data.value.list.length ? '取消全选' : '全选本页' }}</span>
        </button>
      </template>
      <template v-else>
        <div class="seg-tabs" role="tablist" aria-label="审核状态筛选">
          <button type="button" class="seg-tab" :class="{ active: auditStatus === '' }" @click="auditStatus = ''">
            全部
          </button>
          <button type="button" class="seg-tab" :class="{ active: auditStatus === '0' }" @click="auditStatus = '0'">
            待审核
          </button>
          <button type="button" class="seg-tab" :class="{ active: auditStatus === '1' }" @click="auditStatus = '1'">
            已通过
          </button>
          <button type="button" class="seg-tab" :class="{ active: auditStatus === '2' }" @click="auditStatus = '2'">
            已驳回
          </button>
        </div>
      </template>
    </div>

    <LoadState :state="state" v-slot="{ data }">
      <div class="stack tight">
        <article class="ledger-row" v-for="row in data.list" :key="row.itemId ?? row.donationId ?? row.id">
          <div class="row-left">
            <div class="row-thumb">
              <img v-if="row.coverUrl" :src="mediaUrl(row.coverUrl)" alt="" />
              <HeartHandshake v-else-if="!goods" :size="20" />
              <Package v-else :size="20" />
            </div>
            <div>
              <small>
                {{ row.createTime }}
                · {{ [row.campus, row.clubName, row.donorName ? '捐赠人 ' + row.donorName : ''].filter(Boolean).join(' · ') }}
              </small>
              <div class="inline">
                <h3>{{ row.itemTitle || row.title }}</h3>
                <span v-if="row.tradeMode" class="tag" :class="row.tradeMode === 'exchange' ? 'mint' : 'sky'">
                  {{ row.tradeMode === 'exchange' ? '以物易物' : '低价寄售' }}
                </span>
                <span v-if="row.certificateNo" class="tag violet">凭证 {{ row.certificateNo }}</span>
              </div>
              <p class="small">{{ row.auditRemark || row.remark || row.description || '无补充说明' }}</p>
            </div>
          </div>

          <label v-if="goods" class="check-box">
            <input type="checkbox" v-model="checked" :value="row.itemId ?? row.id" />
            <span>选择</span>
          </label>
          <div v-else class="actions">
            <span class="tag" :class="auditTone(row.auditStatus)">
              {{ ['待审核', '已通过', '已驳回'][row.auditStatus] }}
            </span>
            <button
              v-if="user?.role === 'club' && row.auditStatus === 0"
              class="primary"
              @click="current = row.donationId ?? row.id"
            >
              <ClipboardCheck :size="14" />
              <span>审核</span>
            </button>
            <RouterLink
              v-if="row.auditStatus === 1"
              class="btn"
              :to="{
                path: '/certificate/' + (row.donationId ?? row.id),
                query: { certificateNo: row.certificateNo },
              }"
            >
              <FileCheck2 :size="14" />
              <span>查看凭证</span>
            </RouterLink>
          </div>
        </article>
      </div>
      <p v-if="!data.list?.length" class="empty">暂无记录</p>
      <Pager v-if="pageOf(data)?.pages > 1" v-model:page="page" :total="pageOf(data).pages" />
    </LoadState>

    <form v-if="checked.length || current" class="panel stack audit-box" @submit.prevent="audit">
      <div class="spread">
        <h3><ShieldCheck :size="16" /> 审核决定（已选 {{ goods ? checked.length : 1 }} 条）</h3>
        <button type="button" class="text" @click="checked = []; current = null">取消选择</button>
      </div>
      <div class="two-col">
        <label class="field">
          <span>审核结论</span>
          <select v-model="pass">
            <option :value="true">审核通过</option>
            <option :value="false">驳回申请（须填写理由）</option>
          </select>
        </label>
        <label class="field">
          <span>审核意见</span>
          <input v-model="reason" :required="!pass" maxlength="255" placeholder="通过可留空或填寄语，驳回必填原因" />
        </label>
      </div>
      <button class="primary" :disabled="busy" style="justify-self: start">提交审核结论</button>
    </form>
    <p v-if="issue" role="alert" class="error">{{ issue }}</p>
  </main>
</template>

<style scoped>
.stat-pill {
  padding: 14px 18px;
  display: grid;
  gap: 4px;
}
.stat-pill b {
  font-size: 22px;
  font-variant-numeric: tabular-nums;
}
.row-left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.row-thumb {
  width: 52px;
  height: 52px;
  border-radius: 8px;
  background: #f6f4ec;
  border: 1px solid var(--line);
  display: grid;
  place-items: center;
  overflow: hidden;
  flex: none;
  color: var(--muted);
}
.row-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 3px;
}
.check-box {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: #ffffff;
  cursor: pointer;
}
.two-col {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 14px;
}
.audit-box h3 {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
