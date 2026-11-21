<script setup>
import { ref, computed, watch } from 'vue'
import { mine } from '../data'
import ItemCard from '../components/ItemCard.vue'
import MineActions from '../components/MineActions.vue'
import Pager from '../components/Pager.vue'
const tab = ref('全部'),
  page = ref(1)
const filtered = computed(() => mine.filter((r) => tab.value === '全部' || r.status === tab.value))
watch(tab, () => (page.value = 1))
watch(
  () => filtered.value.length,
  (n) => (page.value = Math.max(1, Math.min(page.value, Math.ceil(n / 4)))),
)
</script>
<template>
  <main class="wrap">
    <div class="heading">
      <div>
        <h1>我的闲置</h1>
        <p class="subtitle">
          共 {{ mine.length }} 件 · 在售 {{ mine.filter((r) => r.status === '在售').length }} 件 · 累计流转 24
          次
        </p>
      </div>
      <RouterLink class="btn primary" to="/publish">＋ 发布闲置</RouterLink>
    </div>
    <div class="panel tabs">
      <button
        v-for="s in ['全部', '待审核', '在售', '锁定中', '已下架', '已捐赠']"
        :class="{ chosen: tab === s }"
        @click="tab = s"
      >
        {{ s }} {{ s === '全部' ? mine.length : mine.filter((r) => r.status === s).length }}
      </button>
    </div>
    <div class="cards my-cards">
      <ItemCard
        v-for="r in filtered.slice((page - 1) * 4, page * 4)"
        :key="r.item.id"
        :item="r.item"
        :status="r.status"
        ><p class="small">
          浏览 {{ r.views }} ·
          {{
            r.status === '待审核'
              ? '等待管理员审核'
              : r.status === '已捐赠'
                ? '已捐赠给爱心社'
                : '收到 ' + r.offers + ' 个交换意向'
          }}
        </p>
        <MineActions :row="r"
      /></ItemCard>
    </div>
    <div class="panel empty" v-if="!filtered.length">暂无此状态的闲置</div>
    <div class="panel metrics">
      <div
        v-for="[n, l] in [
          ['24', '累计完成流转'],
          ['2.4 小时', '平均响应时间'],
          ['100%', '履约好评率'],
          ['3', '参与公益活动'],
        ]"
      >
        <b>{{ n }}</b
        ><small>{{ l }}</small>
      </div>
    </div>
    <Pager v-if="filtered.length" v-model:page="page" :total="Math.ceil(filtered.length / 4)" />
  </main>
</template>
<style scoped>
.my-cards {
  margin: 16px 0;
}
.my-cards :deep(.card-cover) {
  height: 140px;
}
.my-cards p {
  margin: 6px 0 10px;
}
</style>
