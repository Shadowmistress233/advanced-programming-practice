<script setup>
import { reactive, computed } from 'vue'
import { AlertTriangle, BarChart3, CheckCircle2, Download, HeartHandshake, PackagePlus } from '@lucide/vue'
import { get, download, useLoad, useAction, campuses } from '../api'
import LoadState from '../components/LoadState.vue'
import TrendChart from '../components/TrendChart.vue'
import AnalyticsChart from '../components/AnalyticsChart.vue'

const filters = reactive({ campus: '', startDate: '', endDate: '' }),
  query = reactive({ ...filters })
const state = useLoad(() => get('/admin/dashboard', query), [query]),
  { busy, issue, run } = useAction()

const series = computed(() => {
  const t = state.data.value?.trend || []
  return Array.isArray(t)
    ? {
        dates: t.map((r) => r.statDate),
        published: t.map((r) => r.publishCount),
        completed: t.map((r) => r.finishCount),
      }
    : t
})

const toChartList = (obj) =>
  Object.entries(obj || {}).map(([name, val]) => ({
    name: val?.name ?? val?.label ?? name,
    value: Number(val?.value ?? val?.count ?? val) || 0,
  }))

const categoryList = computed(() => toChartList(state.data.value?.categoryShare))
const tradeModeList = computed(() => toChartList(state.data.value?.tradeModeShare))
const funnelList = computed(() => toChartList(state.data.value?.funnel))

const indicators = [
  ['publishCount', '发布总量', PackagePlus],
  ['finishCount', '流转成交', CheckCircle2],
  ['donationCount', '公益捐赠', HeartHandshake],
  ['defaultRate', '违约率', AlertTriangle],
]
</script>
<template>
  <main class="wrap live dash-live">
    <header class="page-title">
      <h1>校园运营概览</h1>
      <small>按校区与起止日期聚合发布、成交、捐赠、违约率与 4 步转化漏斗</small>
    </header>
    <form class="toolbar dash-bar" @submit.prevent="Object.assign(query, filters)">
      <label class="field">
        <span>校区</span>
        <select v-model="filters.campus">
          <option value="">全部校区</option>
          <option v-for="c in campuses" :key="c">{{ c }}</option>
        </select>
      </label>
      <label class="field">
        <span>起始日期</span>
        <input v-model="filters.startDate" type="date" :max="filters.endDate" />
      </label>
      <label class="field">
        <span>结束日期</span>
        <input v-model="filters.endDate" type="date" :min="filters.startDate" />
      </label>
      <button class="primary">
        <BarChart3 :size="15" :stroke-width="1.8" />
        <span>查看统计</span>
      </button>
      <button
        type="button"
        :disabled="busy"
        @click="run(() => download('/admin/dashboard/export', '校园运营统计.xlsx', query))"
      >
        <Download :size="15" :stroke-width="1.8" />
        <span>导出当前报表</span>
      </button>
    </form>
    <p v-if="issue" role="alert" class="error">{{ issue }}</p>
    <LoadState :state="state" v-slot="{ data }">
      <div v-if="data" class="stack dash-stack">
        <div class="score-strip">
          <div v-for="[key, label, Icon] in indicators" :key="key">
            <small class="kpi-label">
              <component :is="Icon" :size="14" :stroke-width="1.8" />
              <span>{{ label }}</span>
            </small>
            <h1>{{ (data.kpi || data)[key] ?? '—' }}</h1>
          </div>
        </div>
        <section class="panel dash-panel">
          <h2>发布与成交趋势</h2>
          <TrendChart v-if="series.dates?.length" :series="series" />
          <p v-else class="empty">当前区间暂无趋势数据</p>
        </section>
        <div class="three">
          <section class="panel dash-panel">
            <h2>分类占比（ECharts 饼图）</h2>
            <AnalyticsChart v-if="categoryList.length" kind="pie" :items="categoryList" />
            <p v-else class="empty">暂无数据</p>
          </section>
          <section class="panel dash-panel">
            <h2>流转方式（ECharts 环形图）</h2>
            <AnalyticsChart v-if="tradeModeList.length" kind="ring" :items="tradeModeList" />
            <p v-else class="empty">暂无数据</p>
          </section>
          <section class="panel dash-panel">
            <h2>转化漏斗（发布→浏览→意向→成交）</h2>
            <AnalyticsChart v-if="funnelList.length" kind="funnel" :items="funnelList" />
            <p v-else class="empty">暂无数据</p>
          </section>
        </div>
      </div>
      <p v-else class="empty">暂无统计</p>
    </LoadState>
  </main>
</template>

<style scoped>
.dash-live {
  gap: 12px;
}
.dash-bar {
  padding: 2px 0;
}
.dash-stack {
  gap: 12px;
}
.dash-panel {
  padding: 14px 18px;
}
.dash-panel h2 {
  font-size: 15.5px;
  margin-bottom: 4px;
}
.kpi-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
</style>
