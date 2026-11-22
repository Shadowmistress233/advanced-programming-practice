<script setup>
import { mediaUrl } from '../api'
defineProps({ item: Object })
</script>
<template>
  <article class="listing">
    <RouterLink :to="'/item/' + (item.itemId ?? item.id)" class="listing-link">
      <img v-if="item.coverUrl" :src="mediaUrl(item.coverUrl)" alt="" />
      <div v-else class="listing-placeholder" aria-hidden="true">物</div>
      <div class="listing-copy">
        <small>{{ [item.campus, item.conditionLevel].filter(Boolean).join(' · ') }}</small>
        <h3>{{ item.title }}</h3>
        <b>
          {{
            item.tradeMode === 'consign' || Number(item.price) > 0
              ? '¥' + item.price
              : '换 ' + (item.expectItem || '闲置物品')
          }}
        </b>
        <p v-if="item.reason" class="small">{{ item.reason }}</p>
      </div>
    </RouterLink>
    <slot />
  </article>
</template>
