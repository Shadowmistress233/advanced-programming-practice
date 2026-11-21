<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { itemById, priceText } from '../data'
import { info } from '../feedback'
const route = useRoute(),
  item = computed(() => itemById(route.params.id)),
  selected = ref(0),
  enlarged = ref(false)
const shots = ['正面', '内页', '背面']
const want = computed(() => (item.value.id === 1 ? '英语一真题 / 线性代数教材' : priceText(item.value)))
</script>
<template>
  <main class="wrap">
    <div class="breadcrumb">
      <RouterLink to="/home">首页</RouterLink> / <RouterLink to="/search">{{ item.category }}</RouterLink> /
      <b>{{ item.title }}</b>
    </div>
    <div class="item-layout">
      <div>
        <button
          class="tile hero-photo"
          :class="[item.color, 'slate', 'amber'][selected]"
          @click="enlarged = true"
        >
          {{ selected ? shots[selected] : item.label + '实拍' }}
        </button>
        <div class="thumbs">
          <button
            v-for="(shot, i) in shots"
            class="tile"
            :class="[item.color, 'slate', 'amber'][i]"
            @click="selected = i"
          >
            {{ shot }}</button
          ><small>共 3 张 · 点击查看大图</small>
        </div>
      </div>
      <section class="stack">
        <div class="actions">
          <span class="tag mint">{{ item.method }}</span
          ><span v-for="t in [item.condition, item.category, item.campus + '落']" class="tag">{{ t }}</span>
        </div>
        <h1>
          {{ item.title }}<template v-if="item.id === 1"><br />含真题与笔记</template>
        </h1>
        <div class="panel tinted">
          <small>{{ item.method === '以物易物' ? '希望换到' : '线下面交价' }}</small>
          <div class="spread">
            <h2 class="positive">{{ want }}</h2>
            <span class="tag mint">{{ item.method === '以物易物' ? '等价交换' : '低价寄售' }}</span>
          </div>
          <p class="small subtitle">
            {{ item.id === 1 ? '也可以 ¥58 低价寄售，面交时线下结清' : '面交时当面验物，双方确认后完成流转' }}
          </p>
        </div>
        <div class="detail-buttons">
          <RouterLink class="btn primary" :to="'/exchange/' + item.id">发起交换</RouterLink
          ><button
            @click="info('咨询一下', item.owner + '同学 · 可约在' + item.campus + '校区当面查看物品。')"
          >
            咨询一下</button
          ><RouterLink class="btn soft" :to="'/donate/' + item.id">一键快捐</RouterLink>
        </div>
        <div class="panel spread">
          <div class="inline">
            <span class="avatar">{{ item.owner }}</span>
            <div>
              <b>{{ item.owner }}同学</b> <span class="tag mint">信用 {{ item.credit }}</span>
              <div class="small">{{ item.campus }} · 计算机学院 · 已认证</div>
            </div>
          </div>
          <small>历史流转 12 次 · 好评 100%</small>
        </div>
        <div class="panel rules small">
          · 面交地点：{{ item.campus }}图书馆南门 / 三舍楼下<br />·
          平台不收取任何费用，寄售款项线下当面结清<br />· 爽约将扣除 10 分信用分，请确认时间后再下单
        </div>
      </section>
    </div>
    <div class="panel description">
      <section>
        <h3>物品描述</h3>
        <p>
          {{
            item.description ||
            (item.id === 1
              ? '去年考研用的全套资料，李永乐复习全书 + 660 题 + 历年真题，书内有少量铅笔记号，不影响阅读。真题册做过一遍，答案用铅笔写的，可以擦掉。希望换英语一真题或者线性代数教材，具体可商量。'
              : item.title +
                '，' +
                item.condition +
                '，可在' +
                item.campus +
                '校区面交，欢迎提前联系确认细节。')
          }}
        </p>
      </section>
      <section>
        <h3>履约记录</h3>
        <ul class="timeline">
          <li>与李同学完成一次交换<small>「物品和描述一致，很准时」</small></li>
          <li>向爱心社捐赠 3 件衣物<small>已生成捐赠凭证</small></li>
        </ul>
      </section>
    </div>
    <div v-if="enlarged" class="lightbox" @click="enlarged = false" @keydown.esc="enlarged = false">
      <button
        class="tile"
        :class="[item.color, 'slate', 'amber'][selected]"
        autofocus
        @click="enlarged = false"
      >
        {{ item.title }} · {{ shots[selected] }}<small>关闭大图</small>
      </button>
    </div>
  </main>
</template>
<style scoped>
.item-layout {
  display: grid;
  grid-template-columns: 1.04fr 1fr;
  gap: 24px;
}
.hero-photo {
  width: 100%;
  height: 400px;
  font-size: 30px;
  border-radius: 15px;
}
.thumbs {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  align-items: flex-end;
}
.thumbs button {
  width: 86px;
  height: 86px;
}
.thumbs small {
  margin-left: auto;
}
.detail-buttons {
  display: flex;
  gap: 10px;
}
.detail-buttons > * {
  min-height: 45px;
}
.detail-buttons > :nth-child(-n + 2) {
  flex: 1;
}
.rules {
  background: #fafbfc;
  line-height: 1.9;
}
.description {
  display: grid;
  grid-template-columns: 2.5fr 1fr;
  gap: 22px;
  margin-top: 24px;
  padding: 20px 24px;
}
.description section + section {
  border-left: 1px solid var(--line);
  padding-left: 24px;
}
.description p {
  color: var(--muted);
  line-height: 1.9;
  margin-top: 8px;
}
.lightbox {
  position: fixed;
  inset: 0;
  background: #12241f99;
  display: grid;
  place-items: center;
  z-index: 4;
}
.lightbox button {
  width: min(720px, 88vw);
  height: 55vh;
  font-size: 26px;
}
.lightbox small {
  color: white;
}
@media (max-width: 760px) {
  .item-layout,
  .description {
    grid-template-columns: 1fr;
  }
  .hero-photo {
    height: 250px;
  }
  .thumbs button {
    width: 54px;
    height: 54px;
  }
  .thumbs small {
    font-size: 11px;
  }
  .description section + section {
    border: 0;
    padding: 0;
  }
}
</style>
