<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { clubReviews, goodsReviews, downloadCsv } from '../reviews'
import { statusColor, sample, mine } from '../data'
import { confirmAction, notify } from '../feedback'
const club = useRoute().path === '/club',
  query = ref(''),
  selected = ref([]),
  reason = ref('图文不符'),
  explanation = ref('')
const rows = computed(() => {
  if (club) {
    const donation = sample.donation
    const added =
      donation?.club === '爱心社'
        ? [
            {
              id: 'application',
              title: donation.item.title,
              owner: '张同学',
              time: '本次演示',
              status: donation.status,
            },
          ]
        : []
    return [...added, ...clubReviews]
  }
  const added = mine
    .filter((r) => r.item.id > 100)
    .map((r) => ({
      id: 'new-' + r.item.id,
      itemId: r.item.id,
      title: r.item.title,
      owner: '张同学',
      category: r.item.category,
      time: '本次演示',
      status: r.status === '在售' ? '已通过' : r.status === '已下架' ? '已驳回' : r.status,
    }))
  return [...added, ...goodsReviews]
})
const filtered = computed(() =>
  rows.value.filter((row) => (row.title + row.owner).includes(query.value.trim())),
)
const pending = computed(() => filtered.value.filter((row) => row.status === '待审核'))
const rejecting = ref(club ? null : goodsReviews[1].id)
const target = computed(() => rows.value.find((row) => row.id === rejecting.value && row.status === '待审核'))
function selectAll(e) {
  selected.value = e.target.checked ? pending.value.map((r) => r.id) : []
}
function apply(row, status) {
  if (row.id === 'application') sample.donation.status = status
  else if (row.id.startsWith('new-')) {
    const record = mine.find((r) => r.item.id === row.itemId)
    if (record) record.status = status === '已通过' ? '在售' : '已下架'
  } else row.status = status
  selected.value = selected.value.filter((id) => id !== row.id)
}
function approve(list) {
  if (!list.length) {
    notify('请先选择待审核记录')
    return
  }
  confirmAction(
    '通过审核',
    '确认通过所选的 ' + list.length + ' 项申请？',
    () => {
      list.forEach((r) => apply(r, '已通过'))
      notify('已更新本地审核状态')
    },
    '确认通过',
  )
}
function reject() {
  if (!target.value) return
  const row = target.value
  apply(row, '已驳回')
  rejecting.value = null
  notify('已驳回 · ' + reason.value)
}
function showReject(row) {
  rejecting.value = row.id
  reason.value = '图文不符'
  explanation.value = ''
}
function exportLedger() {
  downloadCsv('爱心社捐赠台账.csv', [
    ['物品', '捐赠人', '申请时间', '状态'],
    ...rows.value.map((r) => [r.title, r.owner, r.time, r.status]),
  ])
}
</script>
<template>
  <div class="heading work-head">
    <div>
      <h1>{{ club ? '待审核捐赠' : '物品审核' }}</h1>
      <p class="subtitle">
        {{
          club
            ? '爱心社 · 今日待处理 ' +
              rows.filter((r) => r.status === '待审核').length +
              ' 件 · 平均处理时长 1.2 天'
            : '待审核 ' +
              (6 + rows.filter((r) => r.status === '待审核').length) +
              ' 件 · 今日已处理 ' +
              (26 + rows.filter((r) => r.status !== '待审核').length) +
              ' 件'
        }}
      </p>
    </div>
    <div class="actions">
      <input v-if="!club" v-model="query" placeholder="搜索标题 / 发布人" aria-label="搜索待审物品" /><button
        @click="approve(pending.filter((r) => selected.includes(r.id)))"
      >
        批量通过</button
      ><button v-if="club" @click="exportLedger">导出台账</button>
    </div>
  </div>
  <section class="panel flush table-scroll">
    <table>
      <thead>
        <tr>
          <th>
            <input
              type="checkbox"
              aria-label="全选待审核物品"
              :checked="pending.length > 0 && pending.every((r) => selected.includes(r.id))"
              @change="selectAll"
            />
          </th>
          <th>物品</th>
          <th>{{ club ? '捐赠人' : '发布人' }}</th>
          <th v-if="!club">分类</th>
          <th>{{ club ? '申请时间' : '提交时间' }}</th>
          <th>状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in filtered" :key="row.id">
          <td>
            <input
              type="checkbox"
              :aria-label="'选择 ' + row.title"
              v-model="selected"
              :value="row.id"
              :disabled="row.status !== '待审核'"
            />
          </td>
          <td>
            <div class="inline">
              <span class="tile thumb" :class="club ? 'teal' : 'green'"></span>
              <div>
                <component :is="club ? 'span' : 'b'">{{ row.title }}</component>
                <div v-if="!club" class="small">#{{ 1024 + i }} · 3 张图</div>
              </div>
            </div>
          </td>
          <td>{{ row.owner }}</td>
          <td v-if="!club">{{ row.category }}</td>
          <td>{{ row.time }}</td>
          <td>
            <span class="tag" :class="statusColor(row.status)">{{ row.status }}</span>
          </td>
          <td>
            <div class="actions">
              <button class="tag mint" :disabled="row.status !== '待审核'" @click="approve([row])">
                通过</button
              ><button class="tag rose" :disabled="row.status !== '待审核'" @click="showReject(row)">
                驳回
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-if="!filtered.length" class="empty">没有符合条件的记录</p>
  </section>
  <div v-if="club" class="three totals">
    <div
      class="panel"
      v-for="([label, n, unit, percent, hint], i) in [
        ['本月已接收', 42, '件', 72, '目标 60 件 · 完成 72%'],
        ['已生成凭证', 36, '张', 86, '6 件待发放'],
        ['审核通过率', '94%', '', 94, '驳回 3 件 · 主要为成色不符'],
      ]"
    >
      <small>{{ label }}</small>
      <h1>
        {{ n }} <small>{{ unit }}</small>
      </h1>
      <div class="bar">
        <i :style="{ width: percent + '%', background: ['#0f8a6a', '#3b82f6', '#f59e0b'][i] }"></i>
      </div>
      <small>{{ hint }}</small>
    </div>
  </div>
  <section v-if="target" class="panel rejection">
    <div class="spread">
      <h3>驳回原因</h3>
      <button class="plain" aria-label="关闭驳回原因" @click="rejecting = null">×</button>
    </div>
    <p class="small subtitle">物品：{{ target.title }} · {{ target.owner }}</p>
    <div class="actions reasons">
      <button
        v-for="r in ['图文不符', '违禁物品', '价格异常', '重复发布']"
        class="chip"
        :class="{ chosen: reason === r }"
        @click="reason = r"
      >
        {{ r }}
      </button>
    </div>
    <textarea
      v-model="explanation"
      aria-label="驳回说明"
      placeholder="图片与描述中的容量不一致，请补充实拍图后重新提交。"
    ></textarea>
    <div class="spread">
      <small>将通知发布人</small>
      <div class="actions">
        <button class="chip" @click="rejecting = null">取消</button
        ><button class="chip rose" @click="reject">确认驳回</button>
      </div>
    </div>
  </section>
</template>
<style scoped>
.work-head {
  margin: 0 0 16px;
}
.work-head input {
  max-width: 220px;
}
.work-head .actions {
  flex-wrap: nowrap;
}
.work-head button {
  white-space: nowrap;
}
th:first-child,
td:first-child {
  width: 34px;
  padding-right: 0;
}
td .tag:is(button) {
  border: 0;
  min-height: 24px;
}
.table-scroll td {
  height: 62px;
}
.totals {
  margin-top: 16px;
}
.totals h1 {
  margin: 4px 0 9px;
}
.bar {
  height: 8px;
  background: #f2f3f5;
  border-radius: 20px;
  margin-bottom: 6px;
}
.bar i {
  display: block;
  height: 100%;
  border-radius: 20px;
}
.rejection {
  width: min(360px, 100%);
  margin: 24px 0 0 auto;
  box-shadow: 0 12px 35px #11182719;
}
.rejection .plain {
  font-size: 20px;
  color: #999;
}
.reasons {
  gap: 5px;
  margin: 14px 0;
}
.reasons .chip {
  padding: 3px 7px;
}
.rejection textarea {
  margin-bottom: 10px;
}
@media (max-width: 600px) {
  .work-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
