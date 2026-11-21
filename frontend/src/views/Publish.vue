<script setup>
import { reactive, ref } from 'vue'
import { get, post, useLoad, useAction, campuses, conditions, categoryOptions } from '../api'
import { useRouter, useRoute } from 'vue-router'
import LoadState from '../components/LoadState.vue'
import { notify } from '../feedback'
const id = useRoute().query.itemId,
  router = useRouter(),
  form = reactive({
    title: '',
    categoryId: '',
    campus: '',
    conditionLevel: '全新',
    tradeMode: 'exchange',
    expectItem: '',
    price: '',
    tradePlace: '',
    description: '',
  }),
  files = ref([])
const state = useLoad(async () => {
  const [categories, item] = await Promise.all([get('/categories/tree'), id ? get('/items/' + id) : null])
  if (item) for (const k in form) form[k] = item[k] ?? form[k]
  return categoryOptions(categories)
})
const { busy, issue, run } = useAction()
function save() {
  run(async () => {
    if (
      files.value.length < 1 ||
      files.value.length > 5 ||
      files.value.some((f) => f.size > 2097152 || !['image/jpeg', 'image/png', 'image/webp'].includes(f.type))
    )
      throw new Error('请选择 1～5 张 JPG、PNG 或 WebP 图片，每张最多 2 MB。')
    const body = new FormData()
    if (id) body.append('itemId', id)
    for (const [k, v] of Object.entries(form))
      if (
        v !== '' &&
        !(k === 'price' && form.tradeMode === 'exchange') &&
        !(k === 'expectItem' && form.tradeMode === 'consign')
      )
        body.append(k, v)
    for (const f of files.value) body.append('images', f)
    await post('/items', body)
    notify('物品已提交审核')
    router.push('/mine')
  })
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title">
      <h1>{{ id ? '编辑闲置' : '发布闲置' }}</h1>
    </header>
    <LoadState :state="state" v-slot="{ data }">
      <form class="panel editor" @submit.prevent="save">
        <label class="field">
          <span>物品名称</span>
          <input v-model="form.title" required minlength="4" maxlength="40" />
        </label>
        <label class="field">
          <span>物品分类</span>
          <select v-model="form.categoryId" required>
            <option value="" disabled>选择分类</option>
            <option v-for="c in data" :value="c.id">{{ c.categoryName }}</option>
          </select>
        </label>
        <label class="field">
          <span>校区</span>
          <select v-model="form.campus" required>
            <option v-for="c in campuses">{{ c }}</option>
          </select>
        </label>
        <label class="field">
          <span>成色</span>
          <select v-model="form.conditionLevel">
            <option v-for="c in conditions">{{ c }}</option>
          </select>
        </label>
        <label class="field">
          <span>流转方式</span>
          <select v-model="form.tradeMode">
            <option value="exchange">交换</option>
            <option value="consign">寄售</option>
          </select>
        </label>
        <template v-if="form.tradeMode === 'exchange'">
          <label class="field">
            <span>希望换到</span>
            <input v-model="form.expectItem" maxlength="100" required />
          </label>
        </template>
        <template v-else>
          <label class="field">
            <span>价格（元）</span>
            <input v-model="form.price" type="number" min=".01" step=".01" required />
          </label>
        </template>
        <label class="field">
          <span>建议面交点</span>
          <input v-model="form.tradePlace" maxlength="50" />
        </label>
        <label class="field">
          物品描述
          <textarea v-model="form.description" maxlength="500" />
        </label>
        <label class="field">
          上传图片（1～5 张，每张最多 2 MB）
          <input
            type="file"
            required
            multiple
            accept="image/jpeg,image/png,image/webp"
            @change="files = Array.from($event.target.files)"
          />
        </label>
        <p v-if="issue" role="alert" class="error">{{ issue }}</p>
        <button class="primary" :disabled="busy">提交审核</button>
      </form>
    </LoadState>
  </main>
</template>
