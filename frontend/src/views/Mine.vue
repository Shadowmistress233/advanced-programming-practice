<script setup>
import { ref, watch } from 'vue'
import { Edit3, EyeOff, Plus, Trash2 } from '@lucide/vue'
import { get, post, useLoad, useAction, pageOf, itemStates } from '../api'
import LoadState from '../components/LoadState.vue'
import { confirmAction, notify } from '../feedback'
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
      notify(action === 'delete' ? '物品已逻辑删除' : '物品已下架')
    }),
  )
}

const stateTone = (s) => ['gold', 'mint', 'sky', 'ink', 'rose'][s] || ''
</script>
<template>
  <main class="wrap live">
    <header class="page-title">
      <h1>我的闲置</h1>
      <small>在售上限正常 10 件（信用 40～59 降为 3 件）；锁定态禁止编辑与删除</small>
    </header>
    <div class="spread" style="flex-wrap: wrap">
      <div class="seg-tabs" role="tablist" aria-label="物品状态筛选">
        <button
          type="button"
          class="seg-tab"
          :class="{ active: status === '' }"
          @click="status = ''"
        >
          全部
        </button>
        <button
          v-for="(s, i) in itemStates"
          :key="i"
          type="button"
          class="seg-tab"
          :class="{ active: status === i }"
          @click="status = i"
        >
          {{ s }}
        </button>
      </div>
      <RouterLink class="btn primary" to="/publish">
        <Plus :size="15" :stroke-width="2" />
        <span>发布闲置</span>
      </RouterLink>
    </div>
    <p v-if="issue" role="alert" class="error">{{ issue }}</p>
    <LoadState :state="state" v-slot="{ data }">
      <div class="listing-grid">
        <ItemCard v-for="item in data.list" :item="item" :key="item.itemId ?? item.id">
          <div class="card-tools">
            <span class="tag" :class="stateTone(item.status)">{{ itemStates[item.status] }}</span>
            <div class="actions" style="margin-left: auto; gap: 6px">
              <template v-if="[0, 1, 4].includes(item.status)">
                <RouterLink
                  class="btn mini-btn"
                  :to="{ path: '/publish', query: { itemId: item.itemId ?? item.id } }"
                >
                  <Edit3 :size="13" />
                  <span>编辑</span>
                </RouterLink>
                <button
                  v-if="item.status === 1"
                  class="mini-btn"
                  @click="change(item.itemId ?? item.id, 'offShelf')"
                >
                  <EyeOff :size="13" />
                  <span>下架</span>
                </button>
                <button
                  class="mini-btn danger"
                  :disabled="busy"
                  @click="change(item.itemId ?? item.id, 'delete')"
                >
                  <Trash2 :size="13" />
                  <span>删除</span>
                </button>
              </template>
              <small v-else>流转中不可编辑</small>
            </div>
          </div>
        </ItemCard>
      </div>
      <div v-if="!data.list?.length" class="empty panel">
        <p>当前筛选下暂无闲置物品</p>
        <RouterLink class="btn primary" to="/publish" style="margin-top: 12px">
          <Plus :size="15" />
          <span>去发布第一件闲置</span>
        </RouterLink>
      </div>
      <Pager v-if="pageOf(data)?.pages > 1" v-model:page="page" :total="pageOf(data).pages" />
    </LoadState>
  </main>
</template>

<style scoped>
.mini-btn {
  min-height: 28px;
  padding: 0 10px;
  font-size: 12.5px;
  border-radius: 7px;
}
</style>
