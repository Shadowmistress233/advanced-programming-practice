<script setup>
import { ref } from 'vue'
import { get, download, useAction } from '../api'
import { useRoute } from 'vue-router'
const route = useRoute(),
  no = ref(route.query.certificateNo || ''),
  result = ref(null),
  { busy, issue, run } = useAction()
function verify() {
  run(async () => {
    result.value = null
    result.value = await get('/donations/verify', { certificateNo: no.value })
  })
}
if (no.value) verify()
</script>
<template>
  <main class="wrap live">
    <header class="page-title"><h1>捐赠凭证</h1></header>
    <form class="panel editor" @submit.prevent="verify">
      <label class="field">
        <span>凭证编号</span>
        <input v-model="no" required />
      </label>
      <button class="primary" :disabled="busy">查询验真</button>
    </form>
    <section v-if="result" class="panel editor">
      <h2>{{ result.valid ? '有效凭证' : '无效凭证' }}</h2>
      <p>{{ result.certificateNo }} · {{ result.itemTitle }}</p>
      <p>{{ result.donorMasked }} → {{ result.clubName }}</p>
      <small>{{ result.auditTime }}</small>
    </section>
    <button
      v-if="route.params.id"
      :disabled="busy"
      @click="run(() => download('/donations/' + route.params.id + '/certificate', '捐赠凭证.pdf'))"
    >
      下载完整 PDF
    </button>
    <p v-if="issue" role="alert" class="error">{{ issue }}</p>
  </main>
</template>
