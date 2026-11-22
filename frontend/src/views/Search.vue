<script setup>
import { reactive, ref } from 'vue'
import { get, useLoad, campuses, conditions, categoryOptions, pageOf } from '../api'
import { useRoute, useRouter } from 'vue-router'
import LoadState from '../components/LoadState.vue'
import ItemCard from '../components/ItemCard.vue'
import Pager from '../components/Pager.vue'
const route = useRoute(),
  router = useRouter(),
  page = ref(Number(route.query.page) || 1)
const defaults = {
  keyword: '',
  categoryId: '',
  conditionLevel: '',
  campus: '',
  tradeMode: '',
  minPrice: '',
  maxPrice: '',
  sort: 'latest',
}
const filters = reactive(
  Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, route.query[k] ?? v])),
)
const categories = useLoad(() => get('/categories/tree'))
const results = useLoad(
  () => get('/items', { ...route.query, page: page.value, pageSize: 12 }),
  [() => route.query, page],
)
function reset() {
  Object.assign(filters, defaults)
  apply()
}
function apply() {
  router.push({
    path: '/search',
    query: Object.fromEntries(Object.entries({ ...filters, page: 1 }).filter(([, v]) => v !== '')),
  })
}
function setPage(p) {
  router.push({ query: { ...route.query, page: p } })
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title"><h1>闲置检索</h1></header>
    <form class="filter-bar panel" @submit.prevent="apply">
      <label class="field">
        <span>关键词</span>
        <input v-model="filters.keyword" type="search" />
      </label>
      <label class="field">
        <span>分类</span>
        <select v-model="filters.categoryId">
          <option value="">全部分类</option>
          <option v-for="c in categoryOptions(categories.data.value)" :value="c.id">
            {{ c.categoryName }}
          </option>
        </select>
      </label>
      <label class="field">
        <span>校区</span>
        <select v-model="filters.campus">
          <option value="">全部校区</option>
          <option v-for="c in campuses">{{ c }}</option>
        </select>
      </label>
      <label class="field">
        <span>成色</span>
        <select v-model="filters.conditionLevel">
          <option value="">全部成色</option>
          <option v-for="c in conditions">{{ c }}</option>
        </select>
      </label>
      <label class="field">
        <span>流转方式</span>
        <select v-model="filters.tradeMode">
          <option value="">不限</option>
          <option value="exchange">以物易物</option>
          <option value="consign">寄售</option>
        </select>
      </label>
      <label class="field">
        <span>最低价</span>
        <input v-model="filters.minPrice" type="number" min="0" step=".01" />
      </label>
      <label class="field">
        <span>最高价</span>
        <input v-model="filters.maxPrice" type="number" :min="filters.minPrice || 0" step=".01" />
      </label>
      <label class="field">
        <span>排序</span>
        <select v-model="filters.sort">
          <option value="latest">最新发布</option>
          <option value="hot">浏览热度</option>
          <option value="price_asc">价格从低到高</option>
          <option value="price_desc">价格从高到低</option>
        </select>
      </label>
      <div class="actions">
        <button class="primary">筛选</button>
        <button type="button" @click="reset">重置</button>
      </div>
    </form>
    <p v-if="categories.error.value" class="error">
      {{ categories.error.value }}
      <button @click="categories.reload">重试分类</button>
    </p>
    <LoadState :state="results" v-slot="{ data }">
      <div class="section-head">
        <h2>搜索结果</h2>
        <small>共 {{ pageOf(data)?.total ?? 0 }} 件</small>
      </div>
      <div class="listing-grid">
        <ItemCard v-for="item in pageOf(data)?.list" :key="item.id ?? item.itemId" :item="item" />
      </div>
      <div v-if="!pageOf(data)?.list?.length">
        <p class="empty">没有匹配的在售物品</p>
        <h3 v-if="data.fallbackList?.length">同类热门物品</h3>
        <div class="listing-grid">
          <ItemCard v-for="item in data.fallbackList" :key="item.id ?? item.itemId" :item="item" />
        </div>
      </div>
      <Pager v-if="pageOf(data)?.pages > 1" :page="page" @update:page="setPage" :total="pageOf(data).pages" />
    </LoadState>
  </main>
</template>
