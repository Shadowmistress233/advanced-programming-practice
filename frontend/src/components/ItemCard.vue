<script setup>
import { computed } from 'vue'
import { BookOpen, Dumbbell, Lamp, Laptop, Package, Sparkles } from '@lucide/vue'
import { mediaUrl } from '../api'

const props = defineProps({ item: Object })

const placeholderIcon = computed(() => {
  const cat = props.item?.categoryName || ''
  if (cat.includes('教材') || cat.includes('读物') || cat.includes('考研')) return BookOpen
  if (cat.includes('电脑') || cat.includes('数码') || cat.includes('手机')) return Laptop
  if (cat.includes('电器') || cat.includes('日用') || cat.includes('生活')) return Lamp
  if (cat.includes('球') || cat.includes('运动')) return Dumbbell
  return Package
})
</script>
<template>
  <article class="listing">
    <RouterLink :to="'/item/' + (item.itemId ?? item.id)" class="listing-link">
      <img v-if="item.coverUrl" :src="mediaUrl(item.coverUrl)" alt="" />
      <div v-else class="listing-placeholder" aria-hidden="true">
        <div class="ph-inner">
          <component :is="placeholderIcon" :size="28" :stroke-width="1.6" />
          <span>{{ item.categoryName || '校园闲置' }}</span>
        </div>
      </div>
      <div class="listing-copy">
        <div class="card-meta-row">
          <small>{{ [item.campus, item.conditionLevel].filter(Boolean).join(' · ') }}</small>
          <span class="tag mini-mode" :class="item.tradeMode === 'exchange' ? 'mint' : 'sky'">
            {{ item.tradeMode === 'exchange' ? '以物易物' : '低价寄售' }}
          </span>
        </div>
        <h3>{{ item.title }}</h3>
        <b>
          {{
            item.tradeMode === 'consign' || Number(item.price) > 0
              ? '¥' + item.price
              : '换 ' + (item.expectItem || '闲置物品')
          }}
        </b>
        <p v-if="item.reason" class="rec-reason">
          <Sparkles :size="11" :stroke-width="2" />
          <span>{{ item.reason }}</span>
        </p>
      </div>
    </RouterLink>
    <slot />
  </article>
</template>

<style scoped>
.ph-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: #5b6175;
}
.ph-inner span {
  font-size: 12px;
  font-weight: 500;
}
.card-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.mini-mode {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 4px;
}
.listing-copy h3 {
  margin: 6px 0 8px;
  line-height: 1.4;
  min-height: 42px;
}
.rec-reason {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f5f3ec;
  color: #5d6375;
  font-size: 11.5px;
}
</style>
