<script setup>
import { ref, computed } from 'vue'
import { get, user, useLoad, pageOf } from '../api'
import LoadState from '../components/LoadState.vue'
import ItemCard from '../components/ItemCard.vue'
const batch = ref(0)
const rec = useLoad(() => get('/recommendations', { campus: user.value?.campus }), [() => user.value?.campus])
const latest = useLoad(() => get('/items', { sort: 'latest', page: 1, pageSize: 12 }))
const categories = useLoad(() => get('/categories/tree'))
const recommendations = computed(() => {
  const items = rec.data.value || []
  if (!items.length) return []
  const start = (batch.value % Math.ceil(items.length / 4)) * 4
  return items.slice(start, start + 4)
})
</script>
<template>
  <main class="wrap live">
    <header class="station">
      <div>
        <p v-if="user">
          {{ user.realName || user.username }} · {{ user.campus }} · 信用 {{ user.creditScore }}
        </p>
        <h1>校园闲置交换站</h1>
      </div>
      <div class="actions">
        <RouterLink class="btn primary" to="/publish">发布闲置</RouterLink>
        <RouterLink class="btn" to="/search">浏览所有物品 →</RouterLink>
      </div>
    </header>
    <LoadState :state="categories" v-slot="{ data }">
      <nav v-if="data?.length" class="category-index" aria-label="按分类浏览">
        <RouterLink v-for="c in data" :key="c.id" :to="{ path: '/search', query: { categoryId: c.id } }">
          {{ c.categoryName }}
        </RouterLink>
      </nav>
    </LoadState>
    <section>
      <div class="section-head">
        <h2>为你推荐</h2>
        <button v-if="rec.data.value?.length > 4" class="last" @click="batch++">换一批</button>
      </div>
      <LoadState :state="rec" v-slot="{ data }">
        <p v-if="!data?.length" class="empty">暂无推荐</p>
        <div class="listing-grid">
          <ItemCard v-for="item in recommendations" :key="item.id ?? item.itemId" :item="item" />
        </div>
      </LoadState>
    </section>
    <h2>最新上架</h2>
    <LoadState :state="latest" v-slot="{ data }">
      <p v-if="!pageOf(data)?.list?.length" class="empty">暂无在售物品</p>
      <div class="listing-grid">
        <ItemCard v-for="item in pageOf(data)?.list" :key="item.id ?? item.itemId" :item="item" />
      </div>
    </LoadState>
  </main>
</template>
