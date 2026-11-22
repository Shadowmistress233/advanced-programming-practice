<script setup>
import { ref, reactive } from 'vue'
import { get, post, useLoad, useAction, pageOf } from '../api'
import { useRoute } from 'vue-router'
import LoadState from '../components/LoadState.vue'
import { notify, confirmAction } from '../feedback'
import Pager from '../components/Pager.vue'
const path = useRoute().path,
  logs = path === '/admin/logs',
  dict = path === '/admin/dicts',
  page = ref(1)
const filters = reactive(
  logs ? { userName: '', operType: '', startTime: '', endTime: '' } : { handleStatus: '', reportType: '' },
)
const query = reactive({ ...filters }),
  selected = ref(null),
  remark = ref(''),
  status = ref(1),
  action = ref('')
const dictType = ref('category'),
  op = ref('list'),
  payload = ref('{}'),
  result = ref(null)
const state = useLoad(
  () =>
    dict
      ? null
      : get(logs ? '/admin/audit-logs' : '/admin/reports', { ...query, page: page.value, pageSize: 12 }),
  [query, page],
)
const { busy, issue, run } = useAction()
function filter() {
  page.value = 1
  Object.assign(query, filters)
  if (logs)
    for (const k of ['startTime', 'endTime']) if (filters[k]) query[k] = filters[k].replace('T', ' ') + ':00'
}
function handle() {
  confirmAction('提交工单处置', '确认提交本次处理结论？', () =>
    run(async () => {
      await post('/admin/reports/' + selected.value + '/handle', {
        handleStatus: Number(status.value),
        action: action.value,
        remark: remark.value,
      })
      selected.value = null
      remark.value = ''
      await state.reload()
    }),
  )
}
function dictionary() {
  const send = () =>
    run(async () => {
      const fields = op.value === 'list' ? {} : JSON.parse(payload.value)
      result.value = await post('/admin/dicts/' + dictType.value, { op: op.value, payload: fields })
      notify('操作已完成')
    })
  if (op.value === 'list') send()
  else confirmAction('更新字典', '确认修改该字典？', send)
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title">
      <h1>{{ logs ? '操作日志' : dict ? '业务字典' : '举报与申诉' }}</h1>
    </header>
    <template v-if="dict">
      <form class="panel editor" @submit.prevent="dictionary">
        <label class="field">
          <span>字典</span>
          <select v-model="dictType">
            <option value="category">分类</option>
            <option value="condition">成色</option>
            <option value="pickup">自提点</option>
            <option value="credit">积分规则</option>
          </select>
        </label>
        <label class="field">
          <span>操作</span>
          <select v-model="op">
            <option value="list">查询</option>
            <option value="add">新增</option>
            <option value="update">更新</option>
            <option value="delete">删除</option>
          </select>
        </label>
        <label v-if="op !== 'list'" class="field">
          记录字段（JSON）
          <textarea v-model="payload" required />
        </label>
        <button class="primary" :disabled="busy">提交</button>
      </form>
      <pre v-if="result" class="panel payload">{{ JSON.stringify(result, null, 2) }}</pre>
    </template>
    <template v-else>
      <form class="toolbar" @submit.prevent="filter">
        <template v-if="logs">
          <label class="field">
            <span>操作人</span>
            <input v-model="filters.userName" />
          </label>
          <label class="field">
            <span>操作类型</span>
            <input v-model="filters.operType" />
          </label>
          <label class="field">
            <span>开始</span>
            <input v-model="filters.startTime" type="datetime-local" />
          </label>
          <label class="field">
            <span>结束</span>
            <input v-model="filters.endTime" type="datetime-local" />
          </label>
        </template>
        <template v-else>
          <label class="field">
            <span>处理状态</span>
            <select v-model="filters.handleStatus">
              <option value="0">待处理</option>
              <option value="1">已处置</option>
              <option value="2">已驳回</option>
              <option value="">全部</option>
            </select>
          </label>
          <label class="field">
            <span>工单类型</span>
            <input v-model="filters.reportType" />
          </label>
        </template>
        <button>查询</button>
      </form>
      <LoadState :state="state" v-slot="{ data }">
        <article v-for="r in data.list" class="ledger-row">
          <div>
            <small>{{ r.createTime || r.operTime }}</small>
            <h3>{{ r.operType || r.reportType }}</h3>
            <p>{{ logs ? [r.userName, r.operDesc || r.description].join(' · ') : r.reportContent }}</p>
          </div>
          <button v-if="!logs && r.handleStatus === 0" @click="selected = r.reportId ?? r.id">处理</button>
        </article>
        <p v-if="!data.list?.length" class="empty">暂无记录</p>
        <Pager v-if="pageOf(data)?.pages > 1" v-model:page="page" :total="pageOf(data).pages" />
      </LoadState>
      <form v-if="selected" @submit.prevent="handle" class="editor panel">
        <label class="field">
          <span>结论</span>
          <select v-model="status">
            <option value="1">已处置</option>
            <option value="2">驳回</option>
          </select>
        </label>
        <label class="field">
          <span>处置动作</span>
          <input v-model="action" required />
        </label>
        <label class="field">
          <span>处置说明</span>
          <input v-model="remark" required />
        </label>
        <button class="primary" :disabled="busy">提交结论</button>
      </form>
    </template>
    <p v-if="issue" role="alert" class="error">{{ issue }}</p>
  </main>
</template>
