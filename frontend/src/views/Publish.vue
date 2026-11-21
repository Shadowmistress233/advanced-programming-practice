<script setup>
import { computed, ref, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { categories, shortNames, sample, itemById, mine } from '../data'
import { confirmAction, notify } from '../feedback'
const route = useRoute(),
  router = useRouter(),
  editing = mine.find((r) => r.item.id === Number(route.query.edit))
const initial = editing?.item || itemById(1)
const form = reactive({
  ...{
    title: initial.title + (editing ? '' : ' 含真题与笔记'),
    category: initial.category,
    condition: initial.condition,
    method: initial.method,
    want: typeof initial.price === 'string' ? initial.price : '',
    price: typeof initial.price === 'number' ? initial.price : 58,
    campus: initial.campus,
    description: '',
    photos: [],
  },
  ...((!editing && sample.draft) || {}),
})
if (!editing && !sample.draft) form.want = '英语一真题 / 线性代数教材'
const label = computed(() => shortNames[categories.indexOf(form.category)]),
  color = computed(
    () => ['green', 'blue', 'teal', 'amber', 'pink', 'slate'][categories.indexOf(form.category)],
  )
const upload = ref(),
  reading = ref(false)
async function addPhotos(event) {
  const files = Array.from(event.target.files)
  event.target.value = ''
  if (
    files.length + form.photos.length > 2 ||
    files.some((f) => !f.type.startsWith('image/') || f.size > 2 * 1024 * 1024)
  ) {
    notify('最多上传 5 张图片，单张图片需小于 2 MB')
    return
  }
  reading.value = true
  try {
    form.photos.push(
      ...(await Promise.all(
        files.map(
          (file) =>
            new Promise((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result)
              reader.onerror = reject
              reader.readAsDataURL(file)
            }),
        ),
      )),
    )
  } catch {
    notify('图片读取失败，请重新选择')
  } finally {
    reading.value = false
  }
}
function draft() {
  sample.draft = { ...form, photos: [...form.photos] }
  notify('草稿已保存在本次演示中')
}
function submit() {
  confirmAction(
    '提交审核',
    '确认将这件闲置加入本地演示审核列表？',
    () => {
      const item = {
        ...initial,
        id: editing ? initial.id : Math.max(100, ...mine.map((r) => r.item.id)) + 1,
        title: form.title,
        category: form.category,
        label: label.value,
        color: color.value,
        condition: form.condition,
        method: form.method,
        campus: form.campus,
        price: form.method === '以物易物' ? form.want : Number(form.price),
        owner: '张',
        credit: 96,
        note: '刚刚',
        description: form.description,
      }
      if (editing) {
        editing.item = item
        editing.status = '待审核'
      } else {
        mine.unshift({ item, status: '待审核', views: 0, offers: 0 })
      }
      sample.draft = null
      notify('已提交演示审核')
      router.push('/mine')
    },
    '提交审核',
  )
}
</script>
<template>
  <main class="wrap publish">
    <div class="heading">
      <div>
        <h1>{{ editing ? '编辑闲置' : '发布闲置' }}</h1>
        <p class="subtitle">填写物品信息，审核通过后即可在首页展示</p>
      </div>
      <small>发布 / 闲置物品</small>
    </div>
    <div class="columns">
      <form class="panel publish-form" @submit.prevent="submit">
        <h3>基本信息</h3>
        <label class="field"
          ><span>标题 <em>*</em></span
          ><input v-model.trim="form.title" required minlength="4" maxlength="40" /><small
            >4~40 字，写清品牌、型号与关键信息</small
          ></label
        >
        <div class="two">
          <label class="field"
            ><span>分类 <em>*</em></span
            ><select v-model="form.category">
              <option v-for="c in categories" :value="c">
                {{ c === '教材资料' ? '教材资料 / 考研' : c }}
              </option>
            </select></label
          >
          <div class="field">
            <b>成色 <em>*</em></b>
            <div class="actions">
              <button
                type="button"
                v-for="c in [...new Set(['全新', '9成新', '7成新', '可用', initial.condition])]"
                :class="{ chosen: c === form.condition }"
                @click="form.condition = c"
              >
                {{ c }}
              </button>
            </div>
          </div>
        </div>
        <hr />
        <h3>流转方式</h3>
        <div class="two">
          <button
            type="button"
            v-for="[method, hint] in [
              ['以物易物', '换取你需要的物品，不涉及金钱'],
              ['低价寄售', '标注价格，线下面交结清'],
            ]"
            class="choice"
            :class="{ selected: form.method === method }"
            @click="form.method = method"
          >
            <div class="spread">
              <b>{{ method }}</b
              ><span>{{ form.method === method ? '●' : '○' }}</span>
            </div>
            <small>{{ hint }}</small>
          </button>
        </div>
        <div class="campus-row">
          <label v-if="form.method === '以物易物'" class="field"
            ><span>希望换到</span><input v-model.trim="form.want" required /></label
          ><label v-else class="field"
            ><span>寄售价格（元）</span
            ><input type="number" min="0.01" step=".01" v-model="form.price" required
          /></label>
          <label class="field"
            ><span>接受校区</span
            ><select v-model="form.campus">
              <option v-for="c in ['本部', '铁道', '湘雅']">{{ c }}</option>
            </select></label
          >
        </div>
        <hr />
        <h3>图片与描述</h3>
        <div class="actions uploads">
          <span
            v-for="(s, i) in ['封面', '内页', '背面']"
            class="tile"
            :class="['green', 'slate', 'amber'][i]"
            >{{ s }}</span
          >
          <button
            type="button"
            class="photo"
            v-for="(src, i) in form.photos"
            :aria-label="'移除图片 ' + (i + 4)"
            @click="form.photos.splice(i, 1)"
          >
            <img :src="src" alt="选中的物品图片" />
          </button>
          <button
            type="button"
            v-if="form.photos.length < 2"
            class="add-img"
            :disabled="reading"
            @click="upload.click()"
          >
            ＋<small>添加图片</small></button
          ><input type="file" accept="image/*" multiple hidden ref="upload" @change="addPhotos" />
          <small>已上传 {{ 3 + form.photos.length }}/5 张<br />单张不超过 2MB</small>
        </div>
        <label class="field"
          ><span>详细描述</span
          ><textarea
            v-model="form.description"
            placeholder="去年考研用的全套资料，书内有少量铅笔记号，不影响阅读……"
          ></textarea>
        </label>
        <div class="form-foot">
          <small>发布即表示同意《闲置流转规则》，爽约将扣减信用分</small>
          <div class="actions">
            <button type="button" @click="draft">存草稿</button
            ><button class="primary" :disabled="reading">提交审核</button>
          </div>
        </div>
      </form>
      <aside class="stack">
        <div class="panel">
          <h3>预览</h3>
          <article class="item-card preview">
            <div class="tile card-cover" :class="color">{{ label }}</div>
            <div class="card-body">
              <b class="item-title">{{ form.title || '物品标题' }}</b>
              <div class="spread card-price">
                <b>{{
                  form.method === '以物易物'
                    ? '换 ' + (form.want === '英语一真题 / 线性代数教材' ? '等价教材' : form.want)
                    : '¥' + form.price
                }}</b
                ><span class="tag mint">{{ form.method }}</span>
              </div>
              <div class="spread small">
                <span>{{ form.campus }} · {{ form.condition }}</span
                ><span>刚刚</span>
              </div>
            </div>
          </article>
        </div>
        <div class="panel notice">
          <h3>发布小贴士</h3>
          <p>
            · 标题写清型号与适用范围，更容易被换到<br />· 多拍细节图，尤其是磨损与缺页处<br />·
            敏感词与违禁物品会在审核阶段被拦截
          </p>
        </div>
      </aside>
    </div>
  </main>
</template>
<style scoped>
.publish {
  padding-top: 14px;
}
.publish .heading {
  margin-bottom: 12px;
}
.publish-form > * + * {
  margin-top: 9px;
}
.publish-form hr {
  margin: 12px 0;
}
.publish-form em {
  color: #e34b54;
  font-style: normal;
}
.campus-row {
  display: grid;
  gap: 16px;
  grid-template-columns: 2.6fr 1fr;
}
.uploads .tile,
.add-img,
.photo {
  width: 88px;
  height: 88px;
}
.add-img {
  display: grid;
  align-content: center;
  gap: 4px;
  border-style: dashed;
  background: #fafbfc;
  color: #9199a4;
  font-size: 19px;
}
.photo {
  padding: 0;
  overflow: hidden;
}
.photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.preview {
  margin-top: 12px;
}
.preview .card-cover {
  height: 150px;
}
.notice p {
  font-size: 13px;
  line-height: 1.9;
  margin-top: 6px;
}
.publish-form .actions {
  gap: 8px;
}
</style>
