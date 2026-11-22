<script setup>
import { ref, watch } from 'vue'
import { get, post, useLoad, useAction, pageOf, itemStates } from '../api'
import LoadState from '../components/LoadState.vue'
import { confirmAction } from '../feedback'
import Pager from '../components/Pager.vue'
import ItemCard from '../components/ItemCard.vue'
const status = ref(''),
  page = ref(1)
watch(status, () => (page.value = 1))
const state = useLoad(
  () => get('/items/mine', { status: status.value, page: page.value, pageSize: 12 }),
  [status, page],
)
const { busy, issue, run } = useAction()
function change(id, action) {
  confirmAction(action === 'delete' ? '删除物品' : '下架物品', '确认更新该物品状态？', () =>
    run(async () => {
      await post('/items/' + id + '/state', { action })
      await state.reload()
    }),
  )
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title"><h1>我的闲置</h1></header>
    <div class="toolbar">
      <label class="field">
        <span>物品状态</span>
        <select v-model="status">
          <option value="">全部</option>
          <option v-for="(s, i) in itemStates" :value="i">{{ s }}</option>
        </select>
      </label>
      <RouterLink class="btn primary" to="/publish">发布闲置</RouterLink>
    </div>
    <p v-if="issue" role="alert" class="error">{{ issue }}</p>
    <LoadState :state="state" v-slot="{ data }">
      <div class="listing-grid">
        <ItemCard v-for="item in data.list" :item="item" :key="item.itemId ?? item.id">
          <div class="card-tools">
            <small>{{ itemStates[item.status] }}</small>
            <template v-if="[0, 1, 4].includes(item.status)">
              <RouterLink :to="{ path: '/publish', query: { itemId: item.itemId ?? item.id } }">
                编辑
              </RouterLink>
              <button v-if="item.status === 1" @click="change(item.itemId ?? item.id, 'offShelf')">
                下架
              </button>
              <button :disabled="busy" @click="change(item.itemId ?? item.id, 'delete')">删除</button>
            </template>
          </div>
        </ItemCard>
      </div>
      <p v-if="!data.list?.length" class="empty">暂无闲置</p>
      <Pager v-if="pageOf(data)?.pages > 1" v-model:page="page" :total="pageOf(data).pages" />
    </LoadState>
  </main>
</template>
