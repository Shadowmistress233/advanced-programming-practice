<script setup>
import { useRoute } from 'vue-router'
import { skills, sample } from '../data'
import { confirmAction, notify, info } from '../feedback'
const route = useRoute(),
  s = [...skills, ...sample.extraSkills].find((s) => s.id === Number(route.params.id)) || skills[0]
const summary =
  s.id === 1
    ? '计算机学院大三，做过两个 Spring 项目，带过 3 个同学过期末。可以从集合、多线程讲到 Spring 基础，也可以帮你改课程设计代码。'
    : '可以提供' + s.title + '，希望找同学互相交流、一起练习。'
function invite() {
  confirmAction(
    '发起互换邀约',
    '向' + s.name + '同学发起「' + s.title + '」的技能交换邀约？',
    () => {
      sample.invited.push(s.id)
      notify('已发出演示邀约')
    },
    '发起邀约',
  )
}
</script>
<template>
  <main class="wrap">
    <div class="breadcrumb">
      <RouterLink to="/skills">技能交换</RouterLink> / {{ s.category }} / <b>{{ s.title.split('（')[0] }}</b>
    </div>
    <div class="columns">
      <div class="stack">
        <section class="panel feature">
          <div class="spread">
            <div class="actions">
              <span class="tag mint">我能提供</span><span class="tag">{{ s.category }}</span
              ><span class="tag">{{ s.level }}</span>
            </div>
            <span class="tag gold">高度互补</span>
          </div>
          <h1>{{ s.title }}</h1>
          <p class="muted">{{ summary }} 时间：每周二、四 19:00–21:00，本部图书馆三楼讨论区。</p>
          <div class="panel tinted spread">
            <div>
              <small>期望换到</small>
              <h2 class="positive">{{ s.want }}</h2>
            </div>
            <button class="primary" :disabled="sample.invited.includes(s.id)" @click="invite">
              {{ sample.invited.includes(s.id) ? '已发出邀约' : '发起互换邀约' }}
            </button>
          </div>
          <hr />
          <h3>为什么推荐给你</h3>
          <div class="three reasons">
            <div
              v-for="[k, v, h] in [
                ['对方能提供', s.title.split('（')[0], '命中你「我需要」的技能'],
                ['对方需要', s.want.split(' / ')[0], '命中你「我能提供」的技能'],
                ['时间匹配', '周二、四 晚上', '与你的空闲时段一致'],
              ]"
              class="panel"
            >
              <small>{{ k }}</small>
              <h4>{{ v }}</h4>
              <small class="positive">✓ {{ h }}</small>
            </div>
          </div>
        </section>
        <section class="panel">
          <h3>对方发布的另一个技能</h3>
          <div class="two reasons">
            <div
              v-for="[k, title, w] in [
                ['我能提供', s.id === 1 ? '数据结构答疑' : s.title, '英语口语'],
                ['我需要', s.want.split(' / ')[0], '每周一次，共 4 次'],
              ]"
              class="panel"
            >
              <span class="tag mint">{{ k }}</span>
              <h4>{{ title }}</h4>
              <small>期望换到：{{ w }}</small>
            </div>
          </div>
        </section>
      </div>
      <aside class="stack">
        <div class="panel">
          <div class="inline">
            <span class="avatar">{{ s.name }}</span>
            <div>
              <b>{{ s.name }}同学</b>
              <div class="small">计算机学院 · 大三 · 已认证</div>
            </div>
          </div>
          <hr />
          <div
            class="kv"
            v-for="[k, v] in [
              ['信用分', s.credit + ' · 优秀'],
              ['完成互换', '7 次'],
              ['好评率', '100%'],
            ]"
          >
            <span>{{ k }}</span
            ><b>{{ v }}</b>
          </div>
          <hr />
          <div class="stack tight">
            <button class="primary" :disabled="sample.invited.includes(s.id)" @click="invite">
              {{ sample.invited.includes(s.id) ? '已发出邀约' : '发起互换邀约' }}</button
            ><button @click="info('先聊聊', '可约时间为每周二、四晚上，本部图书馆。')">先聊聊</button
            ><small>邀约后对方 48 小时未响应会自动关闭；<br />互换完成后双方各 +5 信用分。</small>
          </div>
        </div>
        <div class="panel">
          <h3>收到的评价</h3>
          <div class="actions reasons">
            <span v-for="t in ['讲得清楚', '耐心', '准时']" class="tag mint">{{ t }}</span>
          </div>
          <p class="panel review">
            <small>王同学 · 3 周前</small><br />{{
              s.id === 1
                ? '帮我过了一遍 Spring 的依赖注入，期末考了 88，非常感谢。'
                : '讲解很清楚，约好的时间准时到了。'
            }}
          </p>
        </div>
      </aside>
    </div>
  </main>
</template>
<style scoped>
.feature {
  padding: 24px;
}
.feature h1 {
  margin: 14px 0 10px;
}
.feature p {
  line-height: 1.85;
  margin-bottom: 18px;
}
.reasons {
  margin-top: 14px;
}
.reasons .panel,
.review {
  padding: 14px;
}
.reasons h4 {
  margin: 6px 0;
}
.review {
  background: #fafbfc;
  margin-top: 12px;
}
</style>
