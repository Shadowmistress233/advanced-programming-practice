<script setup>
import { reactive, ref, watch } from 'vue'
import { BookOpen, Dumbbell, Lamp, Laptop, LayoutGrid, RotateCcw, Search } from '@lucide/vue'
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

watch(
  () => route.query,
  (q) => {
    for (const [k, v] of Object.entries(defaults)) filters[k] = q[k] ?? v
    page.value = Number(q.page) || 1
  },
)

const categories = useLoad(() => get('/categories/tree'))
const results = useLoad(
  () => get('/items', { ...route.query, page: page.value, pageSize: 12 }),
  [() => route.query, page],
)

const categoryIcon = {
  教材书籍: BookOpen,
  数码电子: Laptop,
  生活用品: Lamp,
  运动器材: Dumbbell,
}

function selectCategory(catId) {
  filters.categoryId = catId === '' ? '' : String(catId)
  apply()
}
function reset() {
  Object.assign(filters, defaults)
  apply()
}
function apply() {
  router.replace({
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
    <header class="page-title">
      <h1>闲置检索</h1>
      <small>关键词与多条件组合筛选，每页 12 条稳定分页</small>
    </header>

    <nav v-if="categories.data.value?.length" class="category-index" aria-label="快捷分类筛选">
      <button
        type="button"
        :class="{ active: !filters.categoryId }"
        @click="selectCategory('')"
      >
        <LayoutGrid :size="14" :stroke-width="1.8" />
        <span>全部</span>
      </button>
      <button
        v-for="c in categories.data.value"
        :key="c.id"
        type="button"
        :class="{ active: Number(filters.categoryId) === Number(c.id) }"
        @click="selectCategory(c.id)"
      >
        <component :is="categoryIcon[c.categoryName] || BookOpen" :size="14" :stroke-width="1.8" />
        <span>{{ c.categoryName }}</span>
      </button>
    </nav>

    <form class="filter-bar panel" @submit.prevent="apply">
      <label class="field">
        <span>关键词</span>
        <input v-model="filters.keyword" type="search" placeholder="物品名 / 分类 / 关键词" />
      </label>
      <label class="field">
        <span>分类</span>
        <select v-model="filters.categoryId">
          <option value="">全部分类</option>
          <option v-for="c in categoryOptions(categories.data.value)" :key="c.id" :value="String(c.id)">
            {{ c.categoryName }}
          </option>
        </select>
      </label>
      <label class="field">
        <span>校区</span>
        <select v-model="filters.campus">
          <option value="">全部校区</option>
          <option v-for="c in campuses" :key="c">{{ c }}</option>
        </select>
      </label>
      <label class="field">
        <span>成色</span>
        <select v-model="filters.conditionLevel">
          <option value="">全部成色</option>
          <option v-for="c in conditions" :key="c">{{ c }}</option>
        </select>
      </label>
      <label class="field">
        <span>流转方式</span>
        <select v-model="filters.tradeMode">
          <option value="">不限</option>
          <option value="exchange">以物易物</option>
          <option value="consign">低价寄售</option>
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
        <button class="primary">
          <Search :size="14" :stroke-width="1.9" />
          <span>筛选</span>
        </button>
        <button type="button" @click="reset">
          <RotateCcw :size="14" :stroke-width="1.8" />
          <span>重置</span>
        </button>
      </div>
    </form>
    <p v-if="categories.error.value" class="error">
      {{ categories.error.value }}
      <button @click="categories.reload">重试分类</button>
    </p>
    <LoadState :state="results" v-slot="{ data }">
      <div class="section-head" style="margin: 2px 0 10px">
        <h2>搜索结果</h2>
        <small>共 {{ pageOf(data)?.total ?? 0 }} 件</small>
      </div>
      <div class="listing-grid">
        <ItemCard v-for="item in pageOf(data)?.list" :key="item.id ?? item.itemId" :item="item" />
      </div>
      <div v-if="!pageOf(data)?.list?.length">
        <p class="empty">没有匹配的在售物品</p>
        <h3 v-if="data.fallbackList?.length" style="margin-bottom: 12px">同类热门物品</h3>
        <div class="listing-grid">
          <ItemCard v-for="item in data.fallbackList" :key="item.id ?? item.itemId" :item="item" />
        </div>
      </div>
      <Pager v-if="pageOf(data)?.pages > 1" :page="page" @update:page="setPage" :total="pageOf(data).pages" />
    </LoadState>
  </main>
</template>
