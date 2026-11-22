<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { init, use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])
const props = defineProps({ series: { type: Object, required: true } })
const mount = ref()
let chart, observer
function update() {
  chart?.setOption({
    animation: false,
    tooltip: { trigger: 'axis' },
    grid: { left: 36, right: 28, top: 24, bottom: 32 },
    xAxis: {
      type: 'category',
      data: props.series.dates,
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#8e98a4', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      min: 0,
      splitNumber: 4,
      axisLabel: { show: false },
      splitLine: { lineStyle: { color: '#edf0f3' } },
    },
    series: [
      {
        name: '发布',
        type: 'line',
        data: props.series.published,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 2.5 },
        itemStyle: { color: '#334bb5' },
        areaStyle: { color: 'rgba(51,75,181,.13)' },
      },
      {
        name: '成交',
        type: 'line',
        data: props.series.completed,
        showSymbol: false,
        lineStyle: { type: 'dashed', width: 1.5, color: '#8798aa' },
        itemStyle: { color: '#8798aa' },
      },
    ],
  })
}
onMounted(() => {
  chart = init(mount.value)
  update()
  observer = new ResizeObserver(() => chart?.resize())
  observer.observe(mount.value)
})
watch(() => props.series, update)
onBeforeUnmount(() => {
  observer?.disconnect()
  chart?.dispose()
  chart = null
})
</script>
<template>
  <div
    class="chart"
    ref="mount"
    role="img"
    :aria-label="'发布与成交趋势，发布量从 ' + series.published[0] + ' 至 ' + series.published.at(-1) + ' 件'"
  ></div>
</template>
<style scoped>
.chart {
  height: 200px;
  width: 100%;
}
</style>
