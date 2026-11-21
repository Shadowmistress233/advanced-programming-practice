<script setup>
import { computed, ref, onMounted, reactive } from 'vue'
import { useRoute } from 'vue-router'
import { skills, sample } from '../data'
import { notify } from '../feedback'
const route = useRoute(),
  category = ref('全部'),
  mutual = ref(true),
  formDialog = ref(),
  form = reactive({ title: '', want: '', category: '学业辅导' })
const categories = ['学业辅导', '技能教学', '生活服务', '兴趣陪练']
const list = computed(() =>
  [...skills, ...sample.extraSkills].filter(
    (s) =>
      (category.value === '全部' || s.category === category.value) &&
      (!mutual.value || s.complementary !== false),
  ),
)
onMounted(() => {
  if (route.query.publish) formDialog.value.showModal()
})
function publish() {
  sample.extraSkills.unshift({
    ...form,
    id: 100 + sample.extraSkills.length,
    name: '张',
    credit: 96,
    level: '熟练',
    complementary: false,
  })
  mutual.value = false
  category.value = '全部'
  formDialog.value.close()
  notify('已添加本地技能卡片')
}
</script>
<template>
  <main class="wrap">
    <div class="heading">
      <div>
        <h1>技能交换</h1>
        <p class="subtitle">用你会的，换你想学的 · 不涉及金钱</p>
      </div>
      <button class="primary" @click="formDialog.showModal()">＋ 发布技能</button>
    </div>
    <div class="panel spread skill-filters">
      <div class="actions pills">
        <button
          v-for="c in ['全部', ...categories]"
          class="chip"
          :class="{ chosen: category === c }"
          @click="category = c"
        >
          {{ c }}
        </button>
      </div>
      <button class="plain small" role="switch" :aria-checked="mutual" @click="mutual = !mutual">
        仅看与我互补 <span class="switch" :class="{ on: mutual }"></span>
      </button>
    </div>
    <div class="three">
      <article v-for="(s, i) in list" :key="s.id" class="panel skill-card">
        <div class="spread">
          <div class="inline">
            <span class="avatar gray">{{ s.name }}</span
            ><span
              ><b>{{ s.name }}同学</b><small>信用 {{ s.credit }}</small></span
            >
          </div>
          <span class="tag" :class="{ mint: i === 0 }">{{ s.level }}</span>
        </div>
        <RouterLink :to="'/skill/' + s.id"
          ><h2>{{ s.title }}</h2></RouterLink
        ><small>可提供：每周二、四晚上，本部图书馆</small>
        <hr />
        <div class="spread">
          <div>
            <small>期望换到</small><b class="positive">{{ s.want }}</b>
          </div>
          <RouterLink class="btn chip" :class="i === 0 ? 'primary' : 'soft'" :to="'/skill/' + s.id"
            >发起邀约</RouterLink
          >
        </div>
      </article>
    </div>
    <p v-if="!list.length" class="panel empty">当前分类暂无匹配技能</p>
    <dialog ref="formDialog">
      <form class="stack" @submit.prevent="publish">
        <h2>发布技能</h2>
        <label class="field"
          ><span>我能提供</span><input required maxlength="40" v-model.trim="form.title" /></label
        ><label class="field"><span>期望换到</span><input required v-model.trim="form.want" /></label
        ><label class="field"
          ><span>分类</span
          ><select v-model="form.category">
            <option v-for="c in categories">{{ c }}</option>
          </select></label
        >
        <div class="actions end">
          <button type="button" @click="formDialog.close()">取消</button
          ><button class="primary">确认发布</button>
        </div>
      </form>
    </dialog>
  </main>
</template>
<style scoped>
.skill-filters {
  margin-bottom: 16px;
  padding: 15px 20px;
  flex-wrap: wrap;
}
.switch {
  display: inline-block;
  width: 36px;
  height: 20px;
  background: #c6cdd0;
  border-radius: 20px;
  padding: 3px;
}
.switch::before {
  content: '';
  display: block;
  width: 14px;
  height: 14px;
  background: white;
  border-radius: 50%;
}
.switch.on {
  background: var(--green);
}
.switch.on::before {
  margin-left: 16px;
}
.skill-card {
  padding: 18px;
}
.skill-card small {
  display: block;
}
.skill-card h2 {
  margin: 14px 0 6px;
  font-size: 17px;
}
.skill-card .btn {
  padding: 6px 13px;
  font-weight: 650;
}
.skill-card .positive {
  display: block;
  margin-top: 3px;
}
</style>
