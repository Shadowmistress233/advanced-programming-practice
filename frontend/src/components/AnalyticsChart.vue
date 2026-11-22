<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { init, use } from 'echarts/core'
import { PieChart, FunnelChart } from 'echarts/charts'
import { LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([PieChart, FunnelChart, LegendComponent, TooltipComponent, CanvasRenderer])

const props = defineProps({
  kind: { type: String, required: true }, // 'pie' | 'ring' | 'funnel'
  items: { type: Array, default: () => [] }, // [{ name, value, color? }]
})

const mount = ref()
let chart, observer

function paletteFor(name, idx) {
  if (name === '以物易物') return '#0F8A6A'
  if (name === '低价寄售') return '#3B82F6'
  return ['#303E82', '#0F8A6A', '#3B82F6', '#F59E0B', '#7C3AED'][idx % 5]
}

function buildOption() {
  const data = (props.items || []).map((it, idx) => ({
    name: it.name,
    value: Number(it.value) || 0,
    itemStyle: { color: it.color || paletteFor(it.name, idx) },
  }))

  if (props.kind === 'funnel') {
    // 保持「发布 → 浏览 → 意向 → 成交」顺序与平滑梯形几何，label/tooltip 展示真实业务计数
    const tiers = [100, 78, 56, 38]
    const funnelData = data.map((d, idx) => ({
      name: d.name,
      value: tiers[idx] ?? Math.max(20, 100 - idx * 20),
      realValue: d.value,
      itemStyle: { color: ['#303E82', '#3B82F6', '#0F8A6A', '#7C3AED'][idx % 4] },
    }))
    return {
      animation: false,
      tooltip: {
        trigger: 'item',
        formatter: (p) => `${p.name}：${p.data.realValue}`,
      },
      series: [
        {
          type: 'funnel',
          left: '8%',
          right: '8%',
          top: 8,
          bottom: 8,
          sort: 'none',
          gap: 3,
          label: {
            show: true,
            position: 'inside',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 600,
            formatter: (p) => `${p.name}  ${p.data.realValue}`,
          },
          data: funnelData,
        },
      ],
    }
  }

  return {
    animation: false,
    tooltip: { trigger: 'item', formatter: '{b}：{c} ({d}%)' },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { fontSize: 11.5, color: '#475569' },
    },
    series: [
      {
        type: 'pie',
        radius: props.kind === 'ring' ? ['42%', '70%'] : ['0%', '68%'],
        center: ['50%', '41%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
        label: {
          show: true,
          fontSize: 11.5,
          color: '#1F2433',
          formatter: '{b}\n{c}',
        },
        labelLine: { length: 8, length2: 6 },
        data,
      },
    ],
  }
}

function update() {
  chart?.setOption(buildOption(), true)
}

onMounted(() => {
  chart = init(mount.value)
  update()
  observer = new ResizeObserver(() => chart?.resize())
  observer.observe(mount.value)
})
watch(() => [props.kind, props.items], update, { deep: true })
onBeforeUnmount(() => {
  observer?.disconnect()
  chart?.dispose()
  chart = null
})
</script>
<template>
  <div class="subchart" ref="mount"></div>
</template>
<style scoped>
.subchart {
  height: 192px;
  width: 100%;
}
</style>
