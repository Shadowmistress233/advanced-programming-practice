<script setup>
import { priceText } from '../data'
defineProps({ item: { type: Object, required: true }, status: String, foot: String, compact: Boolean })
</script>
<template>
  <article class="item-card">
    <RouterLink :to="'/item/' + item.id" class="tile card-cover" :class="item.color">
      <span
        v-if="status"
        class="tag status"
        :class="{
          gold: status === '待审核',
          sky: status === '锁定中',
          violet: status === '已捐赠',
          mint: status === '在售',
        }"
        >{{ status }}</span
      >{{ item.label }}
    </RouterLink>
    <div class="card-body">
      <RouterLink class="item-title" :to="'/item/' + item.id">{{ item.title }}</RouterLink>
      <slot
        ><div class="spread card-price">
          <b>{{ priceText(item) }}</b
          ><span class="tag">{{ item.method }}</span>
        </div>
        <div v-if="!compact" class="spread meta">
          <span>{{ item.campus }} · {{ item.condition }}</span
          ><span>{{ foot || item.note }}</span>
        </div></slot
      >
    </div>
  </article>
</template>
