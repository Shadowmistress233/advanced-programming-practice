<script setup>
import { ref } from 'vue'
import { get, post, useLoad, useAction, user } from '../api'
import { useRoute, useRouter } from 'vue-router'
import LoadState from '../components/LoadState.vue'
const id = useRoute().params.id,
  router = useRouter(),
  club = ref(''),
  remark = ref('')
const state = useLoad(() => get('/items/' + id)),
  { busy, issue, run } = useAction()
function save() {
  run(async () => {
    await post('/donations', { itemId: Number(id), clubId: Number(club.value), remark: remark.value })
    router.push('/donations')
  })
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title"><h1>捐赠申请</h1></header>
    <LoadState :state="state" v-slot="{ data }">
      <form
        v-if="data.status === 1 && data.ownerId === user?.userId"
        class="panel editor"
        @submit.prevent="save"
      >
        <h2>{{ data.title }}</h2>
        <label class="field">
          <span>接收社团账号 ID</span>
          <input v-model="club" type="number" min="1" step="1" required />
        </label>
        <label class="field">
          <span>捐赠备注</span>
          <input v-model="remark" maxlength="255" />
        </label>
        <p v-if="issue" role="alert" class="error">{{ issue }}</p>
        <button class="primary" :disabled="busy">提交快捐申请</button>
      </form>
      <p v-else class="panel">只能捐赠本人在售的物品。</p>
    </LoadState>
  </main>
</template>
