<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { itemById, sample } from '../data'
import { confirmAction } from '../feedback'
const route = useRoute(),
  router = useRouter(),
  target = itemById(route.params.id)
const options = [6, 7, 9, 1]
  .filter((id) => id !== target.id)
  .slice(0, 3)
  .map((id) => itemById(id))
const chosen = ref(options[0].id),
  message = ref(''),
  offer = computed(() => itemById(chosen.value))
function submit() {
  confirmAction(
    '提交交换意向',
    '确认用「' + offer.value.title + '」交换「' + target.title + '」？',
    () => {
      sample.order = {
        targetId: target.id,
        offerId: chosen.value,
        message: message.value || '希望和你交换这件闲置，可以约时间面交。',
        appointment: null,
        canceled: false,
      }
      router.push('/order')
    },
    '确认提交',
  )
}
</script>
<template>
  <main class="wrap">
    <div class="breadcrumb">
      <RouterLink :to="'/item/' + target.id">物品详情</RouterLink> / <b>发起交换</b>
    </div>
    <div class="heading">
      <div>
        <h1>发起交换</h1>
        <p class="subtitle">选择一件你名下的在售物品作为交换物，对方同意后双方物品将同时锁定</p>
      </div>
    </div>
    <section class="panel exchange">
      <div class="exchange-grid">
        <div>
          <h3>我用来交换的物品</h3>
          <p class="small subtitle">只能选择状态为「在售」的物品</p>
          <button
            v-for="item in options"
            class="choice pick"
            :class="{ selected: chosen === item.id }"
            @click="chosen = item.id"
          >
            <span class="tile mini" :class="item.color">{{ item.label }}</span
            ><span
              ><b>{{ item.title }}</b
              ><small>在售 · {{ item.condition }}</small></span
            ><strong>{{ chosen === item.id ? '●' : '○' }}</strong></button
          ><RouterLink class="text" to="/publish">＋ 去发布新的物品</RouterLink>
        </div>
        <div class="swap"><span>⇄</span><small>双方同时锁定</small></div>
        <div>
          <h3>我想换到的物品</h3>
          <p class="small subtitle">来自 李同学 · 信用 88</p>
          <article class="item-card target">
            <div class="tile card-cover" :class="target.color">{{ target.label }}</div>
            <div class="card-body">
              <h3>{{ target.title }}</h3>
              <div class="actions">
                <span class="tag mint">{{ target.method }}</span
                ><span class="tag">{{ target.condition }}</span>
              </div>
              <small>希望换到：{{ target.id === 1 ? '英语一真题 / 线性代数教材' : target.price }}</small>
            </div>
          </article>
        </div>
      </div>
      <hr />
      <label class="field"
        ><b>给对方留言</b
        ><textarea
          v-model="message"
          placeholder="你好，我有数据结构（C 语言版）第 3 版，9 成新无笔记，想换你的考研数学，本部可以面交～"
        ></textarea>
      </label>
      <div class="form-foot">
        <small
          >提交后你的物品「{{ offer.title }}」将被锁定，对方确认前可随时取消；<br />对方 48
          小时未处理，意向自动关闭。</small
        >
        <div class="actions">
          <RouterLink class="btn" :to="'/item/' + target.id">取消</RouterLink
          ><button class="primary" @click="submit">提交交换意向</button>
        </div>
      </div>
    </section>
  </main>
</template>
<style scoped>
.exchange {
  padding: 24px;
}
.exchange-grid {
  display: grid;
  grid-template-columns: 1fr 14% 1fr;
  align-items: start;
}
.pick {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 10px 0;
  padding: 12px;
}
.pick strong {
  margin-left: auto;
  color: var(--green);
}
.swap {
  align-self: center;
  text-align: center;
  display: grid;
  gap: 8px;
  justify-items: center;
}
.swap span {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--pale);
  color: var(--green);
  font-size: 28px;
}
.target {
  margin-top: 12px;
}
.target .card-cover {
  height: 150px;
}
.target .actions {
  margin: 8px 0;
}
.exchange .form-foot {
  margin-top: 24px;
}
@media (max-width: 760px) {
  .exchange-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .swap {
    display: none;
  }
}
</style>
