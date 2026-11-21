<script setup>
import { ref, watch } from 'vue'
import { get, post, useAction, useLoad, user, pageOf, campuses, categoryOptions } from '../api'
import { useRoute } from 'vue-router'
import LoadState from '../components/LoadState.vue'
import { notify, confirmAction } from '../feedback'
import Pager from '../components/Pager.vue'
const route = useRoute(),
  goods = route.path === '/admin/review',
  page = ref(1),
  auditStatus = ref(''),
  campus = ref(''),
  categoryId = ref('')
const categories = useLoad(() => (goods ? get('/categories/tree') : []))
const checked = ref([]),
  current = ref(null),
  pass = ref(true),
  reason = ref('')
watch([auditStatus, campus, categoryId], () => (page.value = 1))
const state = useLoad(
  () =>
    goods
      ? get('/admin/items/pending', {
          campus: campus.value,
          categoryId: categoryId.value,
          page: page.value,
          pageSize: 12,
        })
      : get('/donations', { auditStatus: auditStatus.value, page: page.value, pageSize: 12 }),
  [page, campus, categoryId, auditStatus],
)
watch([page, campus, categoryId, auditStatus], () => {
  checked.value = []
  current.value = null
})
const { busy, issue, run } = useAction()
function audit() {
  const ids = goods ? [...checked.value] : [current.value]
  const allowed = pass.value,
    msg = reason.value
  confirmAction(allowed ? '确认通过审核' : '确认驳回', '本次将处理 ' + ids.length + ' 条记录。', () =>
    run(async () => {
      if (goods) await post('/admin/items/audit', { itemIds: ids, pass: allowed, reason: msg })
      else await post('/donations/' + ids[0] + '/audit', { pass: allowed, auditRemark: msg })
      checked.value = []
      current.value = null
      reason.value = ''
      await state.reload()
      notify('审核已完成')
    }),
  )
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title">
      <h1>{{ goods ? '物品审核' : '捐赠台账' }}</h1>
    </header>
    <div class="toolbar">
      <template v-if="goods">
        <label class="field">
          <span>校区</span>
          <select v-model="campus">
            <option value="">全部</option>
            <option v-for="c in campuses">{{ c }}</option>
          </select>
        </label>
        <label class="field">
          <span>分类</span>
          <select v-model="categoryId">
            <option value="">全部</option>
            <option v-for="c in categoryOptions(categories.data.value)" :value="c.id">
              {{ c.categoryName }}
            </option>
          </select>
        </label>
      </template>
      <template v-else>
        <label class="field">
          <span>审核状态</span>
          <select v-model="auditStatus">
            <option value="0">待审核</option>
            <option value="1">已通过</option>
            <option value="2">已驳回</option>
            <option value="">全部</option>
          </select>
        </label>
      </template>
    </div>
    <LoadState :state="state" v-slot="{ data }">
      <article class="ledger-row" v-for="row in data.list">
        <div>
          <small>{{ row.createTime }} · {{ row.campus || row.clubName }}</small>
          <h3>{{ row.itemTitle || row.title }}</h3>
          <p>{{ row.remark || row.auditRemark }}</p>
        </div>
        <label v-if="goods">
          <input type="checkbox" v-model="checked" :value="row.itemId ?? row.id" />
          选择
        </label>
        <div v-else class="actions">
          <b>{{ ['待审核', '已通过', '已驳回'][row.auditStatus] }}</b>
          <button
            v-if="user?.role === 'club' && row.auditStatus === 0"
            @click="current = row.donationId ?? row.id"
          >
            审核
          </button>
          <RouterLink
            v-if="row.auditStatus === 1"
            :to="{
              path: '/certificate/' + (row.donationId ?? row.id),
              query: { certificateNo: row.certificateNo },
            }"
          >
            查看凭证
          </RouterLink>
        </div>
      </article>
      <p v-if="!data.list?.length" class="empty">暂无记录</p>
      <Pager v-if="pageOf(data)?.pages > 1" v-model:page="page" :total="pageOf(data).pages" />
    </LoadState>
    <form v-if="checked.length || current" class="panel editor" @submit.prevent="audit">
      <h3>审核决定</h3>
      <select v-model="pass">
        <option :value="true">通过</option>
        <option :value="false">驳回</option>
      </select>
      <label class="field">
        <span>审核意见</span>
        <input v-model="reason" :required="!pass" maxlength="255" />
      </label>
      <button class="primary" :disabled="busy">提交审核</button>
    </form>
    <p v-if="issue" role="alert" class="error">{{ issue }}</p>
  </main>
</template>
