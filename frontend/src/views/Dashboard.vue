<script setup>
import { reactive, computed } from 'vue'
import { get, download, useLoad, useAction, campuses } from '../api'
import LoadState from '../components/LoadState.vue'
import TrendChart from '../components/TrendChart.vue'
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
const indicators = [
  ['publishCount', '发布'],
  ['finishCount', '成交'],
  ['donationCount', '公益捐赠'],
  ['defaultRate', '违约率'],
]
</script>
<template>
  <main class="wrap live">
    <header class="page-title"><h1>校园运营概览</h1></header>
    <form class="toolbar" @submit.prevent="Object.assign(query, filters)">
      <label class="field">
        <span>校区</span>
        <select v-model="filters.campus">
          <option value="">全部校区</option>
          <option v-for="c in campuses">{{ c }}</option>
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
      <button class="primary">查看统计</button>
      <button
        type="button"
        :disabled="busy"
        @click="run(() => download('/admin/dashboard/export', '校园运营统计.xlsx', query))"
      >
        导出当前报表
      </button>
    </form>
    <p v-if="issue" role="alert" class="error">{{ issue }}</p>
    <LoadState :state="state" v-slot="{ data }">
      <div v-if="data" class="stack">
        <div class="score-strip">
          <div v-for="[key, label] in indicators">
            <small>{{ label }}</small>
            <h1>{{ (data.kpi || data)[key] ?? '—' }}</h1>
          </div>
        </div>
        <section class="panel">
          <h2>发布与成交趋势</h2>
          <TrendChart v-if="series.dates?.length" :series="series" />
          <p v-else class="empty">当前区间暂无趋势数据</p>
        </section>
        <div class="bulletins">
          <section
            class="panel"
            v-for="[key, label] in [
              ['categoryShare', '分类占比'],
              ['tradeModeShare', '流转方式'],
              ['funnel', '转化漏斗'],
            ]"
          >
            <h2>{{ label }}</h2>
            <div v-for="(row, name) in data[key]" class="ledger-row">
              <span>{{ row.name ?? row.label ?? name }}</span>
              <b>{{ row.value ?? row.count ?? row }}</b>
            </div>
            <p v-if="!Object.keys(data[key] || {}).length" class="empty">暂无数据</p>
          </section>
        </div>
      </div>
      <p v-else class="empty">暂无统计</p>
    </LoadState>
  </main>
</template>
