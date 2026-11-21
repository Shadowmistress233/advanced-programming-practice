<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { sample } from '../data'
import { confirmAction, notify } from '../feedback'
import code from '../assets/appointment-code.png'
const router = useRouter(),
  days = ['26', '27', '28', '29', '30', '31', '01'],
  times = [
    '09:00',
    '09:30',
    '10:00',
    '10:30',
    '14:00',
    '14:30',
    '15:00',
    '15:30',
    '16:00',
    '16:30',
    '19:00',
    '19:30',
    '20:00',
    '20:30',
    '21:00',
    '21:30',
  ]
const places = ['图书馆南门', '三舍楼下服务点', '二食堂门口'],
  prev = sample.order.appointment
const day = ref(prev?.day || '27'),
  time = ref(prev?.time || '14:30'),
  place = ref(prev?.place || places[0]),
  date = computed(() => (day.value === '01' ? '11' : '10') + ' 月 ' + day.value + ' 日')
function book() {
  confirmAction(
    '确认预约',
    date.value + ' ' + time.value + ' · ' + place.value,
    () => {
      sample.order.appointment = { day: day.value, date: date.value, time: time.value, place: place.value }
      notify('已保存本次演示预约')
      router.push('/order')
    },
    '确认预约',
  )
}
</script>
<template>
  <main class="wrap">
    <div class="breadcrumb"><RouterLink to="/order">流转单</RouterLink> / <b>预约面交</b></div>
    <div class="heading">
      <div>
        <h1>预约面交</h1>
        <p class="subtitle">单号 20261026000123 · 与李同学约定时间与地点</p>
      </div>
    </div>
    <div class="columns">
      <section class="panel booking">
        <h3>1、选择日期</h3>
        <div class="days">
          <button v-for="(d, i) in days" :class="{ primary: day === d }" @click="day = d">
            <b>{{ d }}</b
            ><span>周{{ '一二三四五六日'[i] }}</span>
          </button>
        </div>
        <h3>2、选择时段</h3>
        <p class="small subtitle">灰色时段已被预约或不可用，面交请在 21:00 前完成</p>
        <div class="times">
          <button
            v-for="(t, i) in times"
            :disabled="[2, 3, 8, 11, 15].includes(i)"
            :class="{ chosen: time === t }"
            @click="time = t"
          >
            {{ t }}
          </button>
        </div>
        <h3>3、选择自提点</h3>
        <div class="three">
          <button
            v-for="(p, i) in places"
            class="choice"
            :class="{ selected: place === p }"
            @click="place = p"
          >
            <div class="spread">
              <b>{{ p }}</b
              ><span v-if="!i" class="tag mint">人气</span>
            </div>
            <small>本部 · 距你 {{ [200, 450, 600][i] }}m {{ !i ? '· 有监控' : '' }}</small>
          </button>
        </div>
      </section>
      <aside class="stack">
        <div class="panel">
          <h3>预约确认</h3>
          <div
            class="kv"
            v-for="[k, v] in [
              ['时间', date + ' ' + time],
              ['地点', place],
              ['对方', '李同学 · 信用 88'],
            ]"
          >
            <span>{{ k }}</span
            ><b>{{ v }}</b>
          </div>
          <hr />
          <p class="small">
            确认后双方会收到站内提醒；<br />超过预约时间 24 小时未核销，订单自动关闭并记一次违约。
          </p>
          <button class="primary full" :disabled="sample.order.canceled" @click="book">
            {{ sample.order.canceled ? '订单已取消' : '确认预约' }}
          </button>
        </div>
        <div class="panel">
          <h3>核销二维码</h3>
          <p class="small subtitle">预约成功后生成，面交时由对方扫码</p>
          <div class="qr">
            <img :src="code" alt="设计稿中的演示核销码" /><small>单号 20261026000123 · 演示码</small>
          </div>
        </div>
      </aside>
    </div>
  </main>
</template>
<style scoped>
.booking {
  padding: 22px;
}
.booking h3:not(:first-child) {
  margin-top: 23px;
}
.days,
.times {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}
.days {
  grid-template-columns: repeat(7, minmax(0, 92px));
}
.days button {
  flex-direction: column;
  padding: 12px 3px;
  border-radius: 12px;
  font-weight: 400;
}
.days b {
  font-size: 19px;
}
.times {
  grid-template-columns: repeat(8, minmax(0, 1fr));
  margin-bottom: 20px;
}
.times button {
  padding: 5px 3px;
  font-weight: 400;
}
.times .chosen {
  border-color: var(--green);
}
.booking .three {
  margin-top: 14px;
  gap: 10px;
}
.full {
  width: 100%;
  margin-top: 16px;
}
.qr {
  display: grid;
  justify-items: center;
  gap: 8px;
  margin-top: 12px;
}
.qr img {
  width: 150px;
}
@media (max-width: 620px) {
  .times {
    grid-template-columns: repeat(4, 1fr);
  }
  .days {
    gap: 3px;
  }
  .days button {
    font-size: 12px;
  }
}
</style>
