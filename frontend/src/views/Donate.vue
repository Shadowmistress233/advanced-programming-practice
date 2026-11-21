<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { itemById, sample } from '../data'
import { confirmAction, notify } from '../feedback'
const item = itemById(useRoute().params.id, 7),
  router = useRouter(),
  group = ref(0),
  note = ref(''),
  groups = [
    ['爱心社', '生活用品、衣物、文具', '1,286', 2],
    ['绿色家园', '教材、书籍、电子产品', '642', 3],
    ['阳光助学', '学习用品、冬衣', '318', 4],
  ]
function submit() {
  confirmAction(
    '提交捐赠',
    '确认将「' + item.title + '」捐赠给' + groups[group.value][0] + '？',
    () => {
      sample.donation = { item, club: groups[group.value][0], note: note.value, status: '待审核' }
      notify('捐赠申请已加入本地演示记录')
      router.push('/profile?tab=我的捐赠')
    },
    '提交捐赠',
  )
}
</script>
<template>
  <main class="wrap">
    <div class="breadcrumb"><RouterLink :to="'/item/' + item.id">物品详情</RouterLink> / <b>闲置快捐</b></div>
    <div class="heading">
      <div>
        <h1>捐赠给校内公益社团</h1>
        <p class="subtitle">捐赠不涉及金钱，审核通过后会生成电子凭证</p>
      </div>
    </div>
    <div class="columns">
      <section class="panel donation">
        <h3>1、确认捐赠物品</h3>
        <div class="inline donation-item">
          <div class="tile" :class="item.color">{{ item.label }}</div>
          <div>
            <h3>{{ item.title }}</h3>
            <p>
              <span class="tag">{{ item.condition }}</span> <span class="tag">{{ item.campus }}</span>
            </p>
            <small>当前状态：在售 · 提交后物品将被锁定，等待社团审核</small>
          </div>
        </div>
        <h3>2、选择接收社团</h3>
        <div class="three groups">
          <button
            v-for="([name, range, n, days], i) in groups"
            class="choice"
            :class="{ selected: group === i }"
            @click="group = i"
          >
            <div class="spread">
              <b>{{ name }}</b
              ><span class="tag" :class="{ mint: group === i }">校内认证</span>
            </div>
            <small>服务范围：{{ range }}</small
            ><small>已接收 {{ n }} 件 · 平均 {{ days }} 天完成审核</small>
          </button>
        </div>
        <label class="field"
          ><b>3、补充说明</b
          ><textarea
            v-model="note"
            placeholder="水壶是去年买的，功能正常，因为搬宿舍用不上了，希望送给需要的同学。"
          ></textarea>
        </label>
        <div class="form-foot">
          <small
            >提交即视为同意物品在审核通过后由社团处置；<br />审核不通过会自动解锁，物品回到「在售」。</small
          >
          <div class="actions">
            <RouterLink class="btn" :to="'/item/' + item.id">取消</RouterLink
            ><button class="primary" @click="submit">提交捐赠</button>
          </div>
        </div>
      </section>
      <aside class="stack">
        <div class="panel">
          <h3>这张凭证会记录什么</h3>
          <ul class="timeline">
            <li
              v-for="t in [
                '捐赠人、物品与成色',
                '接收社团与接收时间',
                '唯一凭证编号（可扫码验真）',
                '物资去向公示',
              ]"
            >
              {{ t }}
            </li>
          </ul>
        </div>
        <div class="panel tinted spread">
          <div>
            <small>你的公益记录</small>
            <h2 class="positive">3 次捐赠</h2>
          </div>
          <span class="tag mint">可申领志愿时长</span>
        </div>
        <div class="panel">
          <h3>物资去向公示</h3>
          <p class="small subtitle">
            爱心社 10 月共接收 42 件物资，其中 36 件已发放至新生绿色通道，6 件在库。
          </p>
        </div>
      </aside>
    </div>
  </main>
</template>
<style scoped>
.donation {
  padding: 22px;
}
.donation-item {
  margin: 14px 0 23px;
  align-items: flex-start;
}
.donation-item .tile {
  width: 120px;
  height: 100px;
  font-size: 16px;
}
.donation-item p {
  margin: 7px 0;
}
.groups {
  margin: 14px 0 24px;
  gap: 12px;
}
.donation .form-foot {
  margin-top: 22px;
}
</style>
