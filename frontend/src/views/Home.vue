<script setup>
import { ref, computed } from 'vue'
import { ArrowRight, BookOpen, Dumbbell, Lamp, Laptop, LayoutGrid, Plus, RefreshCw, X } from '@lucide/vue'
import { get, user, useLoad, pageOf } from '../api'
import LoadState from '../components/LoadState.vue'
import ItemCard from '../components/ItemCard.vue'

const batch = ref(0)
const selectedCat = ref('')
const rec = useLoad(() => get('/recommendations', { campus: user.value?.campus }), [() => user.value?.campus])
const latest = useLoad(() => get('/items', { sort: 'latest', page: 1, pageSize: 12 }))
const categories = useLoad(() => get('/categories/tree'))
const catItems = useLoad(
  () => (selectedCat.value ? get('/items', { categoryId: selectedCat.value, sort: 'latest', page: 1, pageSize: 12 }) : null),
  [selectedCat],
)

const recommendations = computed(() => {
  const items = rec.data.value || []
  if (!items.length) return []
  const start = (batch.value % Math.ceil(items.length / 4)) * 4
  return items.slice(start, start + 4)
})

const selectedCatName = computed(() => {
  const hit = (categories.data.value || []).find((c) => Number(c.id) === Number(selectedCat.value))
  return hit?.categoryName || '分类筛选'
})

const categoryIcon = {
  教材书籍: BookOpen,
  数码电子: Laptop,
  生活用品: Lamp,
  运动器材: Dumbbell,
}
</script>
<template>
  <main class="wrap live">
    <header class="station home-hero">
      <div>
        <small v-if="user">
          {{ user.realName || user.username }} · {{ user.campus }} · 信用 {{ user.creditScore }} · 中南四校区校内面交核销
        </small>
        <small v-else>中南大学 · 校内实名认证闲置互助流转与技能交换平台</small>
        <h1>校园闲置交换站</h1>
      </div>
      <div class="actions">
        <RouterLink class="btn primary" to="/publish">
          <Plus :size="15" :stroke-width="2" />
          <span>发布闲置</span>
        </RouterLink>
        <RouterLink class="btn" to="/search">
          <span>浏览所有物品</span>
          <ArrowRight :size="15" :stroke-width="1.8" />
        </RouterLink>
      </div>
    </header>

    <LoadState :state="categories" v-slot="{ data }">
      <nav v-if="data?.length" class="category-index" aria-label="按分类浏览">
        <button
          type="button"
          :class="{ active: selectedCat === '' }"
          @click="selectedCat = ''"
        >
          <LayoutGrid :size="14" :stroke-width="1.8" />
          <span>全部</span>
        </button>
        <button
          v-for="c in data"
          :key="c.id"
          type="button"
          :class="{ active: Number(selectedCat) === Number(c.id) }"
          @click="selectedCat = c.id"
        >
          <component :is="categoryIcon[c.categoryName] || BookOpen" :size="14" :stroke-width="1.8" />
          <span>{{ c.categoryName }}</span>
        </button>
      </nav>
    </LoadState>

    <!-- 选中具体分类时：原地切换展示该分类物品，不跳页不闪烁 -->
    <section v-if="selectedCat">
      <div class="section-head home-sec-head">
        <h2>{{ selectedCatName }}</h2>
        <small v-if="catItems.data.value">共 {{ pageOf(catItems.data.value)?.total ?? 0 }} 件</small>
        <div class="last actions">
          <button type="button" class="mini-reset" @click="selectedCat = ''">
            <X :size="13" />
            <span>返回全部推荐</span>
          </button>
          <RouterLink class="view-all" :to="{ path: '/search', query: { categoryId: selectedCat } }">
            去闲置检索细筛 →
          </RouterLink>
        </div>
      </div>
      <LoadState :state="catItems" v-slot="{ data }">
        <p v-if="!pageOf(data)?.list?.length" class="empty panel">该分类下暂无在售物品</p>
        <div v-else class="listing-grid">
          <ItemCard v-for="item in pageOf(data)?.list" :key="item.id ?? item.itemId" :item="item" />
        </div>
      </LoadState>
    </section>

    <!-- 默认全部态：推荐 + 最新上架 -->
    <template v-else>
      <section>
        <div class="section-head home-sec-head">
          <h2>为你推荐</h2>
          <button v-if="rec.data.value?.length > 4" class="last" @click="batch++">
            <RefreshCw :size="14" :stroke-width="1.8" />
            <span>换一批</span>
          </button>
        </div>
        <LoadState :state="rec" v-slot="{ data }">
          <p v-if="!data?.length" class="empty">暂无推荐</p>
          <div class="listing-grid">
            <ItemCard v-for="item in recommendations" :key="item.id ?? item.itemId" :item="item" />
          </div>
        </LoadState>
      </section>
      <section>
        <div class="section-head home-sec-head">
          <h2>最新上架</h2>
          <RouterLink class="last view-all" to="/search">查看全部 →</RouterLink>
        </div>
        <LoadState :state="latest" v-slot="{ data }">
          <p v-if="!pageOf(data)?.list?.length" class="empty">暂无在售物品</p>
          <div class="listing-grid">
            <ItemCard v-for="item in pageOf(data)?.list" :key="item.id ?? item.itemId" :item="item" />
          </div>
        </LoadState>
      </section>
    </template>
  </main>
</template>

<style scoped>
.home-hero {
  padding: 20px 28px;
}
.home-hero h1 {
  font-size: clamp(26px, 2.7vw, 34px);
  margin-top: 2px;
}
.home-sec-head {
  margin: 4px 0 10px;
}
.view-all {
  font-size: 13.5px;
  color: var(--accent);
  font-weight: 600;
}
.mini-reset {
  min-height: 30px;
  padding: 0 11px;
  font-size: 12.5px;
  border-radius: 99px;
}
</style>
