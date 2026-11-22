<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Lock, Plus, ShieldAlert, Trash2 } from '@lucide/vue'
import { get, post, useLoad, useAction, pageOf, reportTypes } from '../api'
import { useRoute } from 'vue-router'
import LoadState from '../components/LoadState.vue'
import { notify, confirmAction } from '../feedback'
import Pager from '../components/Pager.vue'

const route = useRoute(),
  logs = computed(() => route.path === '/admin/logs'),
  dict = computed(() => route.path === '/admin/dicts'),
  page = ref(1)

const filters = reactive({
  userName: '',
  operType: '',
  startTime: '',
  endTime: '',
  handleStatus: '',
  reportType: '',
})
const query = reactive({ ...filters }),
  selected = ref(null),
  remark = ref(''),
  status = ref(1),
  action = ref('')

// 业务字典结构化状态
const dictType = ref('category'),
  dictList = ref([]),
  newName = ref(''),
  newParentId = ref(''),
  editKey = ref(''),
  editDelta = ref('')

const dictTabs = [
  { key: 'category', label: '物品分类 (category)' },
  { key: 'condition', label: '成色枚举 (condition)' },
  { key: 'pickup_point', label: '校内自提点 (pickup_point)' },
  { key: 'credit_rule', label: '积分规则 (credit_rule)' },
]

const state = useLoad(
  () =>
    dict.value
      ? post('/admin/dicts/' + dictType.value, { op: 'list', payload: {} })
      : get(logs.value ? '/admin/audit-logs' : '/admin/reports', { ...query, page: page.value, pageSize: 12 }),
  [query, page, dictType, logs, dict],
)
watch(
  () => state.data.value,
  (val) => {
    if (dict.value && val?.list) dictList.value = val.list
  },
  { immediate: true },
)

const { busy, issue, run } = useAction()
function filter() {
  page.value = 1
  Object.assign(query, filters)
  if (logs.value)
    for (const k of ['startTime', 'endTime']) if (filters[k]) query[k] = filters[k].replace('T', ' ') + ':00'
}

function handle() {
  confirmAction('提交工单处置', '确认提交本次处理结论？申诉通过将按实扣分回补积分。', () =>
    run(async () => {
      await post('/admin/reports/' + selected.value + '/handle', {
        handleStatus: Number(status.value),
        action: action.value,
        remark: remark.value,
      })
      selected.value = null
      remark.value = ''
      action.value = ''
      await state.reload()
      notify('工单处理完成')
    }),
  )
}

function mutateDict(op, payload, confirmTitle = '更新业务字典') {
  confirmAction(confirmTitle, '确认保存本次字典变更并立即生效？', () =>
    run(async () => {
      await post('/admin/dicts/' + dictType.value, { op, payload })
      newName.value = ''
      newParentId.value = ''
      editKey.value = ''
      await state.reload()
      notify('字典配置已更新')
    }),
  )
}

const reportTone = (s) => (['gold', 'mint', 'rose'][s] || '')
</script>
<template>
  <main class="wrap live">
    <header class="page-title">
      <h1>{{ logs ? '操作日志' : dict ? '业务字典' : '工单处理（举报与积分申诉）' }}</h1>
      <small v-if="logs">AOP @OperLog 异步只读审计日志，仅支持多条件筛选查询</small>
      <small v-else-if="dict">对齐 15 表不扩表约定，分管分类树、只读成色、自提点与积分规则字典</small>
      <small v-else>统一处置普通违规举报与积分扣分申诉工单</small>
    </header>

    <template v-if="dict">
      <div class="seg-tabs" role="tablist" aria-label="业务字典分类">
        <button
          v-for="t in dictTabs"
          :key="t.key"
          type="button"
          class="seg-tab"
          :class="{ active: dictType === t.key }"
          @click="dictType = t.key"
        >
          {{ t.label }}
        </button>
      </div>

      <LoadState :state="state" v-slot="{ data }">
        <section class="panel stack">
          <div v-if="dictType === 'condition'" class="notice spread" style="padding: 10px 14px; border-radius: 8px">
            <span class="inline"><Lock :size="15" /> 成色为系统核心只读枚举，仅支持展示与查看，禁止删除或改写。</span>
          </div>

          <!-- category 结构化表格 -->
          <template v-if="dictType === 'category'">
            <form
              class="inline-form"
              @submit.prevent="mutateDict('add', { categoryName: newName, parentId: newParentId || null }, '新增分类')"
            >
              <select v-model="newParentId" style="max-width: 180px">
                <option value="">作为一级分类</option>
                <option v-for="c in data.list || []" :key="c.id" :value="c.id">{{ c.categoryName }}</option>
              </select>
              <input v-model.trim="newName" required placeholder="输入新分类名称（如：相机配件）" />
              <button class="primary" :disabled="busy"><Plus :size="14" /><span>新增分类</span></button>
            </form>
            <div class="table-scroll">
              <table>
                <thead><tr><th>编号</th><th>一级分类</th><th>二级子类目</th><th>操作</th></tr></thead>
                <tbody>
                  <tr v-for="cat in data.list || []" :key="cat.id">
                    <td>#{{ cat.id }}</td>
                    <td><b>{{ cat.categoryName }}</b></td>
                    <td>
                      <div class="actions">
                        <span v-for="sub in cat.children || []" :key="sub.id" class="tag sky">
                          {{ sub.categoryName }}
                        </span>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        class="text danger"
                        @click="mutateDict('delete', { id: cat.id }, '删除分类')"
                      >
                        <Trash2 :size="14" /> 删除
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <!-- condition 只读表 -->
          <template v-else-if="dictType === 'condition'">
            <div class="actions">
              <span v-for="c in data.list || []" :key="c" class="tag ink">{{ c }}</span>
            </div>
          </template>

          <!-- pickup_point 表格 -->
          <template v-else-if="dictType === 'pickup_point'">
            <form class="inline-form" @submit.prevent="mutateDict('add', { name: newName }, '新增校内自提点')">
              <input v-model.trim="newName" required placeholder="输入新增校内安全自提点（如：科教南楼门厅）" />
              <button class="primary" :disabled="busy"><Plus :size="14" /><span>新增自提点</span></button>
            </form>
            <div class="table-scroll">
              <table>
                <thead><tr><th>序号</th><th>校内自提点名称</th><th>状态</th><th>操作</th></tr></thead>
                <tbody>
                  <tr v-for="(p, idx) in data.list || []" :key="p">
                    <td>{{ idx + 1 }}</td>
                    <td><b>{{ p }}</b></td>
                    <td><span class="tag mint">值守白名单</span></td>
                    <td>
                      <button
                        type="button"
                        class="text danger"
                        @click="mutateDict('delete', { index: idx }, '移除自提点')"
                      >
                        <Trash2 :size="14" /> 移除
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>

          <!-- credit_rule 表格 -->
          <template v-else-if="dictType === 'credit_rule'">
            <div class="table-scroll">
              <table>
                <thead><tr><th>规则键</th><th>业务触发场景</th><th>分值</th><th>操作</th></tr></thead>
                <tbody>
                  <tr v-for="r in data.list || []" :key="r.key">
                    <td><code>{{ r.key }}</code></td>
                    <td>{{ r.label }}</td>
                    <td>
                      <span class="tag" :class="String(r.delta).startsWith('-') ? 'rose' : 'mint'">{{ r.delta }}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        class="text"
                        @click="editKey = r.key; editDelta = r.delta"
                      >
                        调整分值
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <form
              v-if="editKey"
              class="inline-form"
              @submit.prevent="mutateDict('update', { key: editKey, delta: editDelta }, '调整积分规则')"
            >
              <span>修改 <b>{{ editKey }}</b> 分值：</span>
              <input v-model.trim="editDelta" required style="max-width: 120px" placeholder="如 +5 或 -10" />
              <button class="primary" :disabled="busy">保存规则</button>
            </form>
          </template>
        </section>
      </LoadState>
    </template>

    <template v-else>
      <form class="toolbar" @submit.prevent="filter">
        <template v-if="logs">
          <label class="field">
            <span>操作人</span>
            <input v-model="filters.userName" placeholder="如：运营管理员" />
          </label>
          <label class="field">
            <span>操作类型</span>
            <input v-model="filters.operType" placeholder="如：物品审核" />
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
              <option value="">全部</option>
              <option value="0">待处理</option>
              <option value="1">已处置</option>
              <option value="2">已驳回</option>
            </select>
          </label>
          <label class="field">
            <span>工单类型</span>
            <select v-model="filters.reportType">
              <option value="">全部类型</option>
              <option v-for="rt in reportTypes" :key="rt" :value="rt">{{ rt }}</option>
            </select>
          </label>
        </template>
        <button class="primary">查询</button>
      </form>

      <LoadState :state="state" v-slot="{ data }">
        <div class="stack tight">
          <article v-for="r in data.list" :key="r.reportId ?? r.logId" class="ledger-row">
            <div>
              <small>
                {{ r.createTime || r.operTime }}
                <template v-if="r.reporterName"> · 提交人 {{ r.reporterName }}</template>
                <template v-if="r.targetTitle"> · 对象 {{ r.targetTitle }}</template>
              </small>
              <div class="inline">
                <span class="tag" :class="r.reportType === '积分申诉' ? 'violet' : 'ink'">
                  {{ r.operType || r.reportType }}
                </span>
                <b>{{ logs ? [r.userName, r.operDesc || r.description].join(' · ') : r.reportContent }}</b>
              </div>
              <small v-if="r.handleRemark">处置说明：{{ r.handleRemark }}</small>
            </div>
            <div v-if="!logs" class="actions">
              <span class="tag" :class="reportTone(r.handleStatus)">
                {{ ['待处理', '已处置', '已驳回'][r.handleStatus] }}
              </span>
              <button
                v-if="r.handleStatus === 0"
                class="primary"
                @click="selected = r.reportId ?? r.id"
              >
                <ShieldAlert :size="14" />
                <span>处理</span>
              </button>
            </div>
          </article>
        </div>
        <p v-if="!data.list?.length" class="empty">暂无记录</p>
        <Pager v-if="pageOf(data)?.pages > 1" v-model:page="page" :total="pageOf(data).pages" />
      </LoadState>

      <form v-if="selected" @submit.prevent="handle" class="panel stack">
        <div class="spread">
          <h3>处置工单 #{{ selected }}</h3>
          <button type="button" class="text" @click="selected = null">取消</button>
        </div>
        <div class="three">
          <label class="field">
            <span>处理结论</span>
            <select v-model="status">
              <option value="1">核实成立 / 申诉通过</option>
              <option value="2">驳回工单</option>
            </select>
          </label>
          <label class="field">
            <span>处置动作</span>
            <input v-model="action" required placeholder="如：下架物品 / 回补积分 / 驳回申请" />
          </label>
          <label class="field">
            <span>处置说明</span>
            <input v-model="remark" required placeholder="填写清晰处理说明通知申请人" />
          </label>
        </div>
        <button class="primary" :disabled="busy" style="justify-self: start">提交处理结论</button>
      </form>
    </template>
    <p v-if="issue" role="alert" class="error">{{ issue }}</p>
  </main>
</template>

<style scoped>
.inline-form {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.inline-form input {
  flex: 1 1 240px;
}
</style>
