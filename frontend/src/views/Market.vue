<script setup>
import { computed, ref } from 'vue'
import { itemById, priceText, sample } from '../data'
import { info, confirmAction, notify } from '../feedback'
const events = [
  ['毕业季甩卖专场', '即将开始', '报名中', '10-28 09:00–17:00', '本部南校区广场', 128, 200, 'green'],
  ['教材漂流周', '进行中', '进行中', '10-20 – 10-27', '图书馆一楼大厅', 86, 120, 'blue'],
  ['以物换物集市', '报名中', '报名中', '11-02 14:00–18:00', '铁道校区操场', 42, 150, 'amber'],
  ['秋日旧书交换', '已结束', '已结束', '10-12 14:00–17:00', '本部图书馆', 60, 80, 'slate'],
  ['宿舍好物分享', '已结束', '已结束', '10-08 09:00–12:00', '湘雅广场', 43, 60, 'teal'],
  ['开学季闲置集', '已结束', '已结束', '09-15 09:00–17:00', '校本部广场', 92, 100, 'purple'],
]
const tab = ref('全部'),
  all = ref(false)
const filtered = computed(() =>
  tab.value === '全部' ? (all.value ? events : events.slice(0, 3)) : events.filter((e) => e[2] === tab.value),
)
const registered = (title) => sample.registrations.includes(title)
const count = (e) => e[5] + Number(registered(e[0]))
function join(e) {
  confirmAction(
    '报名活动',
    e[0] + ' · ' + e[3] + ' · ' + e[4],
    () => {
      sample.registrations.push(e[0])
      notify('已加入本次演示报名名单')
    },
    '确认报名',
  )
}
const featured = [10, 11, 12, 13].map((id) => itemById(id))
function toggleAll() {
  all.value = !all.value
  tab.value = '全部'
}
</script>
<template>
  <main class="wrap">
    <section class="market-hero spread">
      <div>
        <small>换物集市 · 主题活动</small>
        <h1>毕业季甩卖专场</h1>
        <p>10 月 28 日 09:00 · 本部南校区广场 · 200 个名额</p>
        <div class="actions">
          <button :disabled="registered(events[0][0])" @click="join(events[0])">
            {{ registered(events[0][0]) ? '已报名' : '立即报名' }}</button
          ><button
            class="outline"
            @click="
              info(
                events[0][0],
                '10 月 28 日 09:00–17:00，在本部南校区广场展示和交换毕业季闲置。活动限额 200 人。',
              )
            "
          >
            查看详情
          </button>
        </div>
      </div>
      <div class="capacity">
        <small>剩余名额</small><b>{{ 200 - count(events[0]) }}</b
        ><small>已报名 {{ count(events[0]) }} / 200</small>
      </div>
    </section>
    <div class="section-head">
      <h2>全部活动</h2>
      <button
        class="plain muted"
        @click="toggleAll()"
      >
        共 6 场 · {{ all ? '收起' : '按开始时间排序' }}
      </button>
      <div class="actions last">
        <button
          v-for="t in ['全部', '报名中', '进行中', '已结束']"
          class="chip"
          :class="{ chosen: tab === t }"
          @click="tab = t"
        >
          {{ t }}
        </button>
      </div>
    </div>
    <div class="three">
      <article v-for="e in filtered" class="item-card">
        <div class="tile event-cover" :class="e[7]">{{ e[1] }}</div>
        <div class="event-body">
          <h3>{{ e[0] }}</h3>
          <p class="small subtitle">{{ e[3] }} · {{ e[4] }}</p>
          <div class="bar"><i :style="{ width: (100 * count(e)) / e[6] + '%' }"></i></div>
          <div class="spread small">
            已报名 {{ count(e) }}/{{ e[6] }}<span>{{ Math.floor((100 * count(e)) / e[6]) }}%</span>
          </div>
          <div class="spread event-actions">
            <span class="tag mint">{{ e[2] }}</span
            ><button class="primary chip" :disabled="registered(e[0]) || e[2] === '已结束'" @click="join(e)">
              {{ registered(e[0]) ? '已报名' : e[2] === '已结束' ? '已结束' : '立即报名' }}
            </button>
          </div>
        </div>
      </article>
    </div>
    <div class="section-head">
      <h2>活动专区</h2>
      <span class="muted">已打上「毕业季」标识的物品</span
      ><RouterLink to="/search?event=graduation" class="last muted"
        >查看全部 {{ featured.length }} 件 ›</RouterLink
      >
    </div>
    <div class="cards">
      <RouterLink class="item-card" v-for="(item, i) in featured" :to="'/item/' + item.id"
        ><div class="tile card-cover" :class="item.color">{{ item.label }}</div>
        <div class="card-body">
          <b>{{ item.title }}</b>
          <div class="spread">
            <b class="positive">{{ priceText(item) }}</b
            ><span class="tag">{{ ['9成新', '以物易物', '8成新', '3 天'][i] }}</span>
          </div>
        </div></RouterLink
      >
    </div>
  </main>
</template>
<style scoped>
.wrap {
  padding-top: 20px;
}
.market-hero {
  border-radius: 16px;
  background: linear-gradient(110deg, #0f866b, #0c6956);
  color: white;
  padding: 20px 30px;
}
.market-hero small {
  color: #dbf0e7;
}
.market-hero h1 {
  font-size: 32px;
  margin: 5px 0;
}
.market-hero .actions {
  margin-top: 14px;
}
.market-hero button {
  height: 46px;
  color: var(--green);
}
.market-hero .outline {
  color: white;
  border-color: #ffffff55;
  background: transparent;
}
.capacity {
  text-align: right;
}
.capacity b {
  display: block;
  font-size: 44px;
  line-height: 1.2;
}
.section-head {
  margin-top: 22px;
}
.event-cover {
  height: 104px;
  border-radius: 0;
  font-size: 18px;
}
.event-body {
  padding: 12px 16px;
}
.bar {
  height: 8px;
  background: #f2f3f5;
  border-radius: 5px;
  margin: 10px 0 6px;
}
.bar i {
  display: block;
  background: var(--green);
  height: 100%;
  border-radius: 5px;
}
.event-actions {
  margin-top: 10px;
}
.card-body .spread {
  margin-top: 10px;
}
.cards .card-cover {
  height: 120px;
}
@media (max-width: 480px) {
  .market-hero {
    padding: 18px;
  }
  .market-hero h1 {
    font-size: 24px;
  }
  .capacity b {
    font-size: 30px;
  }
}
</style>
