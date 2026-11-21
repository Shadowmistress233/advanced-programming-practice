<script setup>
import { ref, computed } from 'vue'
import ItemCard from '../components/ItemCard.vue'
import { items, categories } from '../data'
const category = ref('全部'),
  tab = ref('全部'),
  offset = ref(0)
const pool = computed(() =>
  items.filter((item) => category.value === '全部' || category.value === item.category),
)
const recommended = computed(() =>
  pool.value.map((_, i) => pool.value[(i + offset.value) % pool.value.length]).slice(0, 4),
)
const latest = computed(() =>
  [...items.slice(4), ...items.slice(0, 4)]
    .filter(
      (item) =>
        (tab.value === '全部' || item.label === tab.value) &&
        (category.value === '全部' || item.category === category.value),
    )
    .slice(0, 4),
)
function selectCategory(value) {
  category.value = value
  offset.value = 0
}
</script>
<template>
  <main class="wrap home">
    <section class="panel welcome">
      <div class="spread">
        <div>
          <h2>下午好，张同学</h2>
          <p class="subtitle">你的信用分 96，属于优秀等级 · 本学期已流转 4 件</p>
        </div>
        <div class="actions">
          <RouterLink class="btn primary" to="/publish">发布闲置</RouterLink
          ><RouterLink class="btn" to="/skills?publish=1">发布技能</RouterLink>
        </div>
      </div>
      <div class="actions pills">
        <button
          v-for="c in ['全部', ...categories]"
          :class="['chip', { chosen: category === c }]"
          @click="selectCategory(c)"
        >
          {{ c }}
        </button>
      </div>
    </section>
    <div class="section-head">
      <h2>为你推荐</h2>
      <span class="muted">根据你的浏览与发布标签生成</span
      ><button class="plain last muted" @click="offset += Math.min(4, Math.max(1, pool.length - 1))">
        换一批 ↻
      </button>
    </div>
    <div v-if="recommended.length" class="cards">
      <ItemCard
        v-for="item in recommended"
        :key="item.id"
        :item="item"
        :foot="item.id <= 4 ? '推荐理由：' + item.note : item.note"
      />
    </div>
    <p v-else class="panel empty">这个分类暂无推荐物品</p>
    <div class="section-head">
      <h2>最新发布</h2>
      <button
        v-for="t in ['全部', '教材', '数码', '生活']"
        class="chip"
        :class="{ chosen: tab === t }"
        @click="tab = t"
      >
        {{ t }}</button
      ><span class="last muted">共 1,284 件 · 按发布时间排序</span>
    </div>
    <div v-if="latest.length" class="cards">
      <ItemCard v-for="item in latest" :key="item.id" :item="item" />
    </div>
    <p v-else class="panel empty">暂无符合条件的闲置</p>
  </main>
</template>
<style scoped>
.home {
  padding-top: 20px;
}
.welcome {
  padding: 16px 22px;
  background: linear-gradient(110deg, #f1faf6, #fff 72%);
}
.welcome h2 {
  font-size: 21px;
}
.pills {
  margin-top: 14px;
}
@media (max-width: 600px) {
  .welcome .spread {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
