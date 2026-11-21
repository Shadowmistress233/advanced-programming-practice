<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { items, categories, priceText } from '../data'
import Pager from '../components/Pager.vue'
const route = useRoute(),
  query = computed(() => String(route.query.q || ''))
const groups = [
  ['分类', 'category', categories.slice(0, 5)],
  ['成色', 'condition', ['全新', '9成新', '7成新', '8成新', '95新']],
  ['校区', 'campus', ['本部', '铁道', '湘雅']],
  ['流转方式', 'method', ['以物易物', '低价寄售', '可捐赠']],
]
const filters = reactive({ category: '', condition: '', campus: '', method: '', min: '', max: '' }),
  sort = ref('最热'),
  page = ref(1)
const sorted = computed(() => {
  const ordered = [1, 6, 2, 3, 7, 4, 5, 8, 9, 10, 11, 12, 13, 14, 15].map((id) => items[id - 1])
  const result = ordered.filter(
    (item) =>
      (route.query.event !== 'graduation' || [10, 11, 12, 13].includes(item.id)) &&
      query.value
        .toLowerCase()
        .split(/\s+/)
        .every((word) =>
          [item.title, item.category, item.label, item.campus, item.method, item.id === 3 ? '自行车' : '']
            .join(' ')
            .toLowerCase()
            .includes(word),
        ) &&
      groups.every(
        ([, key]) =>
          !filters[key] ||
          (key === 'method' && filters.method === '可捐赠'
            ? ['教材资料', '生活用品', '服饰鞋包'].includes(item.category)
            : item[key] === filters[key]),
      ) &&
      ((filters.min === '' && filters.max === '') ||
        (typeof item.price === 'number' &&
          (filters.min === '' || item.price >= Number(filters.min)) &&
          (filters.max === '' || item.price <= Number(filters.max)))),
  )
  if (sort.value === '价格 ↓') result.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))
  if (sort.value === '最新发布') result.sort((a, b) => b.id - a.id)
  if (sort.value === '距离最近')
    result.sort((a, b) => Number(b.campus === '本部') - Number(a.campus === '本部'))
  return result
})
watch([filters, sort, query], () => (page.value = 1))
function clear() {
  for (const key in filters) filters[key] = ''
}
</script>
<template>
  <main class="wrap">
    <div class="spread search-head">
      <div class="breadcrumb">
        <RouterLink to="/home">首页</RouterLink> / <b>搜索{{ query ? '「' + query + '」' : '' }}</b> · 共
        {{ sorted.length }} 条结果
      </div>
      <div class="actions">
        <button
          v-for="s in ['最新发布', '最热', '距离最近', '价格 ↓']"
          class="chip"
          :class="{ chosen: s === sort }"
          @click="sort = s"
        >
          {{ s }}
        </button>
      </div>
    </div>
    <div class="search-layout">
      <aside class="panel filters">
        <div class="spread">
          <h3>筛选</h3>
          <button class="plain" @click="clear">清空</button>
        </div>
        <section v-for="[label, key, values] in groups">
          <h4>{{ label }}</h4>
          <div class="actions">
            <button
              v-for="v in values"
              class="chip"
              :class="{ chosen: filters[key] === v }"
              @click="filters[key] = filters[key] === v ? '' : v"
            >
              {{ v === '以物易物' ? '可交换' : v === '低价寄售' ? '可寄售' : v }}
            </button>
          </div>
        </section>
        <section>
          <h4>价格区间</h4>
          <div class="inline">
            <input
              type="number"
              min="0"
              v-model="filters.min"
              aria-label="最低价格"
              placeholder="最低"
            />—<input type="number" min="0" v-model="filters.max" aria-label="最高价格" placeholder="最高" />
          </div>
        </section>
      </aside>
      <div class="panel flush">
        <RouterLink
          v-for="(item, index) in sorted.slice((page - 1) * 5, page * 5)"
          :key="item.id"
          :to="'/item/' + item.id"
          class="result"
        >
          <div class="tile result-pic" :class="item.color">{{ item.label }}</div>
          <div class="grow">
            <div class="spread">
              <h2>{{ item.title }}</h2>
              <b class="positive">{{ priceText(item) }}</b>
            </div>
            <div class="actions result-tags">
              <span class="tag" :class="item.method === '以物易物' ? 'mint' : 'sky'">{{ item.method }}</span
              ><span class="tag">{{ item.condition }}</span
              ><span class="tag">{{ item.campus }}</span>
            </div>
            <div class="spread muted">
              <span>{{ item.owner }}同学 · 信用 {{ item.credit }} · {{ item.campus }}</span
              ><span>{{ ['3 分钟前', '18 分钟前', '1 小时前', '2 小时前', '3 小时前'][index] }}</span>
            </div>
          </div></RouterLink
        >
        <div v-if="!sorted.length" class="empty">暂无匹配物品，试试其他关键词或筛选条件。</div>
        <Pager v-else v-model:page="page" :total="Math.ceil(sorted.length / 5)" />
      </div>
    </div>
  </main>
</template>
<style scoped>
.search-head {
  margin: 0 0 16px;
}
.search-head .breadcrumb {
  margin: 0;
}
.search-layout {
  display: grid;
  grid-template-columns: 236px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.filters {
  padding: 16px;
}
.filters section {
  margin-top: 10px;
  padding-top: 9px;
  border-top: 1px solid var(--line);
}
.filters h4 {
  margin-bottom: 6px;
}
.filters .actions {
  gap: 6px;
}
.result {
  display: flex;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
}
.result-pic {
  width: 128px;
  height: 98px;
  flex: none;
  font-size: 18px;
}
.result h2 {
  font-size: 16px;
}
.result .positive {
  font-size: 18px;
}
.result-tags {
  margin: 11px 0;
}
.result .muted {
  font-size: 13px;
}
@media (max-width: 760px) {
  .search-layout {
    grid-template-columns: 1fr;
  }
  .search-head {
    flex-wrap: wrap;
  }
  .result-pic {
    width: 75px;
    height: 80px;
  }
  .result .spread {
    flex-wrap: wrap;
    gap: 4px;
  }
}
</style>
