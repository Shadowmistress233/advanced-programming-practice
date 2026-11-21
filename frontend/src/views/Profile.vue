<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { mine, statusColor, sample, skills, itemById } from '../data'
import { info } from '../feedback'
import Pager from '../components/Pager.vue'
import MineActions from '../components/MineActions.vue'
const route = useRoute(),
  tabs = ['我的发布', '我的交换', '我的捐赠', '我的技能']
const tab = ref(tabs.includes(route.query.tab) ? route.query.tab : tabs[0]),
  page = ref(1)
const records = computed(() => {
  if (tab.value === '我的发布') return [...mine].sort((a, b) => rank(a.item.id) - rank(b.item.id))
  if (tab.value === '我的交换')
    return [
      {
        title: itemById(sample.order.offerId).title + ' ↔ ' + itemById(sample.order.targetId).title,
        status: sample.order.canceled ? '已取消' : sample.order.appointment ? '已预约' : '已确认',
        detail: '20261026000123',
        link: '/order',
        action: '查看订单',
      },
    ]
  if (tab.value === '我的捐赠')
    return [
      ...(sample.donation
        ? [
            {
              title: sample.donation.item.title,
              status: sample.donation.status,
              detail: sample.donation.club,
              link: sample.donation.status === '已通过' ? '/certificate?current=1' : '',
              action: '查看凭证',
            },
          ]
        : []),
      {
        title: '小米电热水壶 1.5L',
        status: '已捐赠',
        detail: '爱心社',
        link: '/certificate',
        action: '查看凭证',
      },
    ]
  return [
    ...skills.filter((s) => [1, 4].includes(s.id)),
    ...sample.extraSkills.filter((s) => s.name === '张'),
  ].map((s) => ({
    title: s.title,
    status: '已发布',
    detail: s.want,
    link: '/skill/' + s.id,
    action: '查看技能',
  }))
})
function rank(id) {
  return id > 100 ? -1 : ({ 1: 0, 3: 1, 7: 2, 6: 3 }[id] ?? id + 4)
}
watch(tab, () => (page.value = 1))
watch(
  () => records.value.length,
  (n) => (page.value = Math.max(1, Math.min(page.value, Math.ceil(n / 4)))),
)
</script>
<template>
  <main class="wrap profile">
    <aside class="stack">
      <section class="panel identity">
        <span class="avatar">张</span>
        <h2>张同学</h2>
        <p class="small">中南大学 · 计算机学院 · 2024 级</p>
        <div class="badges"><span class="tag mint">已认证</span> <span class="tag">本部落</span></div>
        <div class="metrics">
          <div
            v-for="[n, l, url] in [
              [96, '信用分', '/credit'],
              [mine.length, '在售', '/mine'],
              [24, '已流转', '/order'],
            ]"
          >
            <RouterLink :to="url"
              ><b>{{ n }}</b
              ><small>{{ l }}</small></RouterLink
            >
          </div>
        </div>
        <button class="full" @click="info('编辑资料', '张同学 · 中南大学 · 计算机学院 · 2024 级 · 本部校区')">
          编辑资料
        </button>
      </section>
      <section class="panel">
        <h3>安全设置</h3>
        <button
          v-for="s in ['修改密码', '校园身份认证', '关联手机号', '消息偏好']"
          class="side-link"
          @click="info(s, '当前使用本地示例身份，设置入口供页面演示。')"
        >
          {{ s }}</button
        ><RouterLink to="/login" class="side-link">切换角色</RouterLink>
      </section>
    </aside>
    <section>
      <div class="panel tabs">
        <button v-for="(s, i) in tabs" :class="{ chosen: tab === s }" @click="tab = s">
          {{ s }}
          {{
            [
              mine.length,
              24,
              sample.donation ? 4 : 3,
              2 + sample.extraSkills.filter((s) => s.name === '张').length,
            ][i]
          }}
        </button>
      </div>
      <div class="panel flush table-scroll">
        <table v-if="tab === tabs[0]">
          <thead>
            <tr>
              <th>物品</th>
              <th>状态</th>
              <th>浏览</th>
              <th>收到意向</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in records.slice((page - 1) * 4, page * 4)" :key="r.item.id">
              <td>
                <RouterLink class="inline" :to="'/item/' + r.item.id"
                  ><span class="tile thumb" :class="r.item.color"></span>{{ r.item.title }}</RouterLink
                >
              </td>
              <td>
                <span class="tag" :class="statusColor(r.status)">{{ r.status }}</span>
              </td>
              <td>{{ r.views }}</td>
              <td>{{ r.offers || '—' }}</td>
              <td><MineActions :row="r" /></td>
            </tr>
          </tbody>
        </table>
        <table v-else>
          <thead>
            <tr>
              <th>{{ tab.slice(2) }}记录</th>
              <th>状态</th>
              <th>{{ tab === tabs[1] ? '流转单号' : tab === tabs[2] ? '接收社团' : '期望换到' }}</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in records.slice((page - 1) * 4, page * 4)">
              <td>{{ r.title }}</td>
              <td>
                <span class="tag" :class="statusColor(r.status)">{{ r.status }}</span>
              </td>
              <td>{{ r.detail }}</td>
              <td>
                <RouterLink v-if="r.link" class="btn chip" :to="r.link">{{ r.action }}</RouterLink
                ><small v-else>等待社团处理</small>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <Pager v-model:page="page" :total="Math.max(1, Math.ceil(records.length / 4))" />
    </section>
  </main>
</template>
<style scoped>
.profile {
  display: grid;
  grid-template-columns: minmax(250px, 26%) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.identity {
  text-align: center;
  padding: 24px;
}
.identity > .avatar {
  width: 76px;
  height: 76px;
  font-size: 30px;
}
.identity h2 {
  margin-top: 12px;
}
.identity p {
  margin: 4px 0 10px;
}
.badges {
  margin-bottom: 8px;
}
.identity .metrics {
  margin: 8px 0;
}
.identity .full {
  width: 100%;
}
.profile > section {
  min-width: 0;
}
.profile .tabs {
  margin-bottom: 16px;
}
.profile td {
  height: 62px;
}
.profile td .actions {
  gap: 4px;
}
.profile td .chip {
  padding: 2px 7px;
}
.profile .side-link:last-child {
  color: var(--muted);
}
@media (max-width: 760px) {
  .profile {
    grid-template-columns: 1fr;
  }
  .profile aside {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: start;
    gap: 8px;
  }
}
@media (max-width: 480px) {
  .profile aside {
    grid-template-columns: 1fr;
  }
}
</style>
