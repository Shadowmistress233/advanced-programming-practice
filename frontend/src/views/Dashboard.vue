<script setup>
import { ref, computed } from 'vue'
import TrendChart from '../components/TrendChart.vue'
import { downloadCsv } from '../reviews'
const period = ref('近 7 天')
const periods = {
  '近 7 天': {
    dates: ['10-19', '10-20', '10-21', '10-22', '10-23', '10-24', '10-25', '10-26'],
    published: [8, 13, 11, 18, 16, 24, 29, 32],
    completed: [3, 6, 5, 9, 8, 13, 17, 21],
  },
  本周: {
    dates: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    published: [21, 18, 24, 28, 22, 30, 32],
    completed: [9, 8, 14, 17, 14, 18, 21],
  },
  '近 30 天': {
    dates: ['09-27', '10-02', '10-07', '10-12', '10-17', '10-22', '10-26'],
    published: [12, 17, 14, 21, 23, 27, 32],
    completed: [5, 8, 7, 13, 14, 16, 21],
  },
}
const series = computed(() => periods[period.value])
const stats = [
  ['今日发布', '32', '↑ 12% 较昨日'],
  ['今日成交', '18', '↑ 8% 较昨日'],
  ['捐赠件数', '6', '本周累计 42 件'],
  ['违约率', '2.4%', '↓ 0.6% 较上周'],
]
const shares = [
  ['教材资料', 38, '#0f8a6a'],
  ['数码电子', 24, '#3b82f6'],
  ['生活用品', 18, '#f59e0b'],
  ['运动器材', 12, '#a78bfa'],
  ['其他', 8, '#e5e7eb'],
]
const funnel = [
  ['发布', '1,284', 100],
  ['浏览', '9,640', 78],
  ['发起意向', '1,320', 56],
  ['完成流转', '860', 34],
]
function report() {
  downloadCsv('校园循环统计报表.csv', [
    ['日期', '发布', '成交'],
    ...series.value.dates.map((d, i) => [d, series.value.published[i], series.value.completed[i]]),
  ])
}
</script>
<template>
  <div class="heading dashboard-head">
    <div>
      <h1>数据看板</h1>
      <p class="subtitle">统计口径：本部 · {{ period }} · 每日 01:00 预聚合</p>
    </div>
    <div class="actions">
      <button
        v-for="p in ['本周', '近 7 天', '近 30 天']"
        class="chip"
        :class="{ chosen: period === p }"
        @click="period = p"
      >
        {{ p }}</button
      ><button @click="report">导出报表</button>
    </div>
  </div>
  <div class="cards indicators">
    <div class="panel" v-for="([label, n, hint], i) in stats">
      <small>{{ label }}</small>
      <h1 :class="{ warning: i === 3 }">{{ n }}</h1>
      <small :class="{ positive: i < 2, warning: i === 3 }">{{ hint }}</small>
    </div>
  </div>
  <div class="chart-row">
    <section class="panel">
      <div class="spread">
        <h3>发布与成交趋势</h3>
        <small><b class="positive">●</b> 发布　▪ 成交</small>
      </div>
      <TrendChart :series="series" />
    </section>
    <section class="panel">
      <h3>分类占比</h3>
      <div class="ring-row">
        <div class="ring categories">
          <div><small>总计</small><b>1,284</b></div>
        </div>
        <ul>
          <li v-for="[label, n, color] in shares">
            <i :style="{ background: color }"></i>{{ label }} {{ n }}%
          </li>
        </ul>
      </div>
    </section>
  </div>
  <div class="two lower">
    <section class="panel">
      <h3>转化漏斗</h3>
      <p class="small subtitle">发布 → 浏览 → 发起意向 → 完成</p>
      <div class="funnel" v-for="[l, n, p] in funnel">
        <div class="spread small">
          <span>{{ l }}</span
          ><span>{{ n }} · {{ p }}%</span>
        </div>
        <b :style="{ width: p + '%' }">{{ n }}</b>
      </div>
    </section>
    <section class="panel">
      <h3>流转方式</h3>
      <div class="ring-row">
        <div class="ring methods">
          <div><b>63%</b><small>以物易物</small></div>
        </div>
        <div>
          <ul>
            <li><i></i>以物易物 63%</li>
            <li><i style="background: #3b82f6"></i>低价寄售 37%</li>
          </ul>
          <p class="small subtitle">以物易物占比高于上周 5%</p>
        </div>
      </div>
    </section>
  </div>
</template>
<style scoped>
.dashboard-head {
  margin-bottom: 14px;
}
.indicators .panel {
  padding: 15px 18px;
}
.indicators h1 {
  margin: 2px 0;
}
.warning {
  color: #ac6006;
}
.chart-row {
  display: grid;
  grid-template-columns: 1.9fr 1fr;
  gap: 16px;
  margin: 16px 0;
}
.chart-row .panel,
.lower .panel {
  padding: 16px 18px;
}
.chart-row .spread {
  margin-bottom: 8px;
}
.ring-row {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  margin-top: 14px;
}
.ring {
  width: 132px;
  aspect-ratio: 1;
  border-radius: 50%;
  display: grid;
  place-items: center;
  flex: none;
}
.ring.categories {
  background: conic-gradient(#0f8a6a 0 38%, #3b82f6 38% 62%, #f59e0b 62% 80%, #a78bfa 80% 92%, #e5e7eb 92%);
}
.ring.methods {
  width: 110px;
  background: conic-gradient(#0f8a6a 0 63%, #3b82f6 63%);
}
.ring > div {
  background: white;
  border-radius: 50%;
  width: 63%;
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.ring-row ul {
  padding: 0;
  list-style: none;
  margin: 0;
}
.ring-row li {
  font-size: 12.5px;
  margin: 6px 0;
}
.ring-row li i {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 5px;
  border-radius: 50%;
  background: var(--green);
}
.funnel {
  margin: 10px 0;
}
.funnel b {
  display: block;
  margin: 4px auto;
  background: var(--pale);
  color: var(--green);
  text-align: center;
  padding: 4px;
  border-radius: 5px;
}
@media (max-width: 900px) {
  .chart-row {
    grid-template-columns: 1fr;
  }
  .ring-row {
    gap: 12px;
  }
}
</style>
