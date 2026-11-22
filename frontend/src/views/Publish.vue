<script setup>
import { computed, onUnmounted, reactive, ref } from 'vue'
import { AlertCircle, ArrowLeftRight, CheckCircle2, ImagePlus, ShoppingBag, UploadCloud, X } from '@lucide/vue'
import { get, post, useLoad, useAction, campuses, conditions, categoryOptions, pickupPoints, mediaUrl } from '../api'
import { useRouter, useRoute } from 'vue-router'
import LoadState from '../components/LoadState.vue'
import { notify } from '../feedback'

const route = useRoute(),
  id = computed(() => route.query.itemId),
  router = useRouter(),
  defaultForm = {
    title: '',
    categoryId: '',
    campus: '本部',
    conditionLevel: '九成新',
    tradeMode: 'exchange',
    expectItem: '',
    price: '',
    tradePlace: pickupPoints[0],
    description: '',
  },
  form = reactive({ ...defaultForm }),
  files = ref([]),
  previews = ref([]),
  existingImages = ref([])

const state = useLoad(async () => {
  const curId = id.value
  const [categories, item] = await Promise.all([get('/categories/tree'), curId ? get('/items/' + curId) : null])
  if (item) {
    for (const k in form) form[k] = item[k] ?? defaultForm[k]
    existingImages.value = (item.images?.length ? item.images : item.coverUrl ? [item.coverUrl] : []).map(
      (x) => x.imgUrl ?? x,
    )
  } else {
    Object.assign(form, defaultForm)
    existingImages.value = []
  }
  return categoryOptions(categories)
}, [id])

const { busy, issue, run } = useAction()

const totalImagesCount = computed(() => (files.value.length ? files.value.length : existingImages.value.length))

function onFileChange(event) {
  for (const url of previews.value) URL.revokeObjectURL(url)
  const picked = Array.from(event.target.files || [])
  files.value = picked
  previews.value = picked.map((f) => URL.createObjectURL(f))
}

function removeFile(idx) {
  URL.revokeObjectURL(previews.value[idx])
  files.value.splice(idx, 1)
  previews.value.splice(idx, 1)
}

onUnmounted(() => {
  for (const url of previews.value) URL.revokeObjectURL(url)
})

function save() {
  run(async () => {
    const curId = id.value
    const hasExisting = Boolean(curId && existingImages.value.length)
    if (!files.value.length && !hasExisting) {
      throw new Error('请上传 1～5 张 JPG、PNG 或 WebP 实物图片，每张最多 2 MB。')
    }
    if (
      files.value.length > 5 ||
      files.value.some((f) => f.size > 2097152 || !['image/jpeg', 'image/png', 'image/webp'].includes(f.type))
    ) {
      throw new Error('图片须为 1～5 张 JPG、PNG 或 WebP，每张不超过 2 MB。')
    }
    const body = new FormData()
    if (curId) body.append('itemId', curId)
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
      <small>支持以物易物与低价寄售双模式，提交后进入管理员合规审核</small>
    </header>
    <LoadState :state="state" v-slot="{ data }">
      <form class="split-desk" @submit.prevent="save">
        <section class="panel stack form-card">
          <div class="field-row">
            <label class="field">
              <span>物品名称（4～40 字）</span>
              <input v-model="form.title" required minlength="4" maxlength="40" placeholder="例如：《计算机网络》第八版教材" />
            </label>
          </div>

          <div class="two-col">
            <label class="field">
              <span>物品分类</span>
              <select v-model="form.categoryId" required>
                <option value="" disabled>选择分类</option>
                <option v-for="c in data" :key="c.id" :value="c.id">{{ c.categoryName }}</option>
              </select>
            </label>
            <label class="field">
              <span>所在校区</span>
              <select v-model="form.campus" required>
                <option v-for="c in campuses" :key="c">{{ c }}</option>
              </select>
            </label>
          </div>

          <div class="two-col">
            <label class="field">
              <span>成色评级</span>
              <select v-model="form.conditionLevel">
                <option v-for="c in conditions" :key="c">{{ c }}</option>
              </select>
            </label>
            <label class="field">
              <span>建议面交自提点</span>
              <select v-model="form.tradePlace">
                <option v-for="p in pickupPoints" :key="p" :value="p">{{ p }}</option>
              </select>
            </label>
          </div>

          <div class="field">
            <span>流转方式</span>
            <div class="mode-switch">
              <button
                type="button"
                class="mode-btn"
                :class="{ active: form.tradeMode === 'exchange', mint: form.tradeMode === 'exchange' }"
                @click="form.tradeMode = 'exchange'"
              >
                <ArrowLeftRight :size="15" />
                <span>以物易物</span>
              </button>
              <button
                type="button"
                class="mode-btn"
                :class="{ active: form.tradeMode === 'consign', sky: form.tradeMode === 'consign' }"
                @click="form.tradeMode = 'consign'"
              >
                <ShoppingBag :size="15" />
                <span>低价寄售</span>
              </button>
            </div>
          </div>

          <label v-if="form.tradeMode === 'exchange'" class="field">
            <span>希望换到（最多 100 字）</span>
            <input v-model="form.expectItem" maxlength="100" required placeholder="例如：考研英语词汇书或台灯" />
          </label>
          <label v-else class="field">
            <span>期望价格（元，面交当面结清）</span>
            <input v-model="form.price" type="number" min="0.01" step="0.01" required placeholder="输入合理校内转让价" />
          </label>

          <label class="field">
            <span>物品说明（最多 500 字）</span>
            <textarea
              v-model="form.description"
              rows="3"
              maxlength="500"
              placeholder="描述入手时间、使用痕迹、配件情况或面交时段偏好…"
            />
          </label>
        </section>

        <aside class="stack">
          <section class="panel stack">
            <div class="spread">
              <h3>实物图片上传</h3>
              <span class="tag" :class="totalImagesCount > 0 ? 'mint' : ''">
                已选 {{ totalImagesCount }} / 5 张
              </span>
            </div>
            <label class="upload-box">
              <UploadCloud :size="24" :stroke-width="1.7" />
              <b>点击选择或更换实物图片</b>
              <small>支持 JPG / PNG / WebP，1～5 张，单张 ≤ 2 MB，首图默认作为封面</small>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                @change="onFileChange"
              />
            </label>

            <div v-if="previews.length" class="thumb-grid">
              <div v-for="(src, idx) in previews" :key="src" class="thumb-item">
                <img :src="src" alt="上传预览" />
                <button type="button" class="thumb-del" aria-label="移除图片" @click="removeFile(idx)">
                  <X :size="12" />
                </button>
                <span v-if="idx === 0" class="cover-badge">封面</span>
              </div>
            </div>
            <div v-else-if="existingImages.length" class="thumb-grid">
              <div v-for="(src, idx) in existingImages" :key="src" class="thumb-item">
                <img :src="mediaUrl(src)" alt="已有图片" />
                <span v-if="idx === 0" class="cover-badge">原图</span>
              </div>
            </div>
            <div v-else class="thumb-placeholder">
              <ImagePlus :size="16" />
              <span>上传清晰实物照片更容易通过审核与成交</span>
            </div>
          </section>

          <section class="panel tinted stack">
            <h3>发布须知与信用激励</h3>
            <ul class="rule-list">
              <li><CheckCircle2 :size="14" /><span>审核通过上架可获 <b>+2 信用分</b>，完成核销再获 <b>+5 分</b>。</span></li>
              <li><CheckCircle2 :size="14" /><span>正常用户在售上限 10 件（信用 40～59 降为 3 件）。</span></li>
              <li><AlertCircle :size="14" /><span>严禁发布宿舍大功率违禁电器、虚拟卡密及商业批量货源。</span></li>
            </ul>
            <p v-if="issue" role="alert" class="error">{{ issue }}</p>
            <div class="actions">
              <button class="primary submit-full" :disabled="busy">
                <span>{{ id ? '保存并重新提审' : '提交审核' }}</span>
              </button>
              <RouterLink class="btn" to="/mine">返回我的闲置</RouterLink>
            </div>
          </section>
        </aside>
      </form>
    </LoadState>
  </main>
</template>

<style scoped>
.form-card {
  gap: 14px;
}
.two-col {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.mode-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.mode-btn {
  min-height: 40px;
  border-radius: 9px;
  background: #fffdf8;
  border: 1px solid var(--line);
}
.mode-btn.active {
  border-color: currentColor;
  font-weight: 700;
}
.upload-box {
  position: relative;
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 6px;
  padding: 20px 16px;
  border: 1.5px dashed #b9c0d4;
  border-radius: 10px;
  background: #faf9f4;
  color: #303e82;
  cursor: pointer;
}
.upload-box:hover {
  border-color: var(--accent);
  background: #f2f4fc;
}
.upload-box input[type='file'] {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.thumb-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.thumb-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--line);
  background: #ffffff;
}
.thumb-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.thumb-del {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  min-height: 0;
  padding: 0;
  border-radius: 50%;
  background: rgba(31, 36, 51, 0.72);
  color: #ffffff;
  border: 0;
}
.cover-badge {
  position: absolute;
  left: 4px;
  bottom: 4px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #303e82;
  color: #ffffff;
  font-size: 11px;
}
.thumb-placeholder {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f5f3ec;
  color: var(--muted);
  font-size: 12.5px;
}
.rule-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 9px;
  font-size: 13px;
  color: #384056;
}
.rule-list li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.rule-list li .lucide {
  margin-top: 3px;
  color: #303e82;
}
.submit-full {
  flex: 1;
}
@media (max-width: 600px) {
  .two-col {
    grid-template-columns: 1fr;
  }
}
</style>
