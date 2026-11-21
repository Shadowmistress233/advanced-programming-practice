<script setup>
import { useRouter } from 'vue-router'
import { mine } from '../data'
import { confirmAction, notify } from '../feedback'
const props = defineProps({ row: Object }),
  router = useRouter()
function change(action) {
  confirmAction(action + '闲置', '确认' + action + '「' + props.row.item.title + '」？', () => {
    if (action === '删除') mine.splice(mine.indexOf(props.row), 1)
    else props.row.status = action === '上架' ? '在售' : '已下架'
    notify('本次演示已' + action)
  })
}
</script>
<template>
  <div class="actions">
    <button
      v-if="['在售', '待审核', '已下架'].includes(row.status)"
      class="chip"
      @click="router.push({ path: '/publish', query: { edit: row.item.id } })"
    >
      编辑
    </button>
    <template v-if="row.status === '在售'"
      ><button class="chip" @click="change('下架')">下架</button
      ><button class="chip" @click="change('删除')">删除</button></template
    >
    <button v-else-if="row.status === '待审核'" class="chip" @click="change('撤回')">撤回</button
    ><button v-else-if="row.status === '已下架'" class="chip" @click="change('上架')">上架</button>
    <RouterLink v-else-if="row.status === '锁定中'" class="btn chip" to="/order">查看订单</RouterLink>
    <RouterLink v-else-if="row.status === '已捐赠'" class="btn chip" to="/certificate">查看凭证</RouterLink>
  </div>
</template>
