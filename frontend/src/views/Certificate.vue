<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { sample } from '../data'
import { info, notify } from '../feedback'
import code from '../assets/certificate-code.png'
const route = useRoute(),
  d = computed(() => (route.query.current && sample.donation?.status === '已通过' ? sample.donation : null))
const fields = computed(() => [
  ['凭证编号', d.value ? 'CSU-DEMO-0001' : 'CSU202610000123'],
  ['捐赠时间', d.value ? '本次演示' : '2026-10-12 10:26'],
  ['捐 赠 人', '张同学（学号 8204210101）'],
  ['接收社团', (d.value?.club || '爱心社') + '（校内认证）'],
  ['物品名称', d.value?.item.title || '小米电热水壶 1.5L'],
  ['成色 / 数量', (d.value?.item.condition || '9 成新') + ' / 1 件'],
  ['物资用途', '新生绿色通道 · 生活物资发放'],
])
function printCertificate() {
  window.print()
}
async function share() {
  try {
    await navigator.clipboard.writeText(location.href)
    notify('已复制凭证演示链接')
  } catch {
    info('分享给社团', location.href)
  }
}
</script>
<template>
  <main class="certificate-page">
    <div class="certificate-wrap">
      <article class="paper">
        <div class="border">
          <header>
            <div class="inline"><span class="logo">循</span>中南大学 · 校园闲置互助流转平台</div>
            <h1>捐赠电子凭证</h1>
            <p>DONATION CERTIFICATE</p>
          </header>
          <dl>
            <div v-for="[k, v] in fields">
              <dt>{{ k }}</dt>
              <dd>{{ v }}</dd>
            </div>
          </dl>
          <footer>
            <p class="small">
              本凭证由平台自动生成，扫码可验证真伪。<br />物资去向将在社团台账中公示，可在「我的捐赠」中查看。
            </p>
            <img :src="code" alt="设计稿中的凭证示例码" />
            <div class="stamp">
              <small>中南大学</small><b>{{ d?.club || '爱心社' }}</b
              ><small>专用章</small>
            </div>
          </footer>
        </div>
      </article>
      <div class="actions">
        <button class="primary" @click="printCertificate">下载 PDF</button
        ><button @click="share">分享给社团</button
        ><button
          @click="
            info(
              '物资去向',
              '接收社团：' + (d?.club || '爱心社') + '。物资用途：新生绿色通道 · 生活物资发放。',
            )
          "
        >
          查看物资去向
        </button>
      </div>
    </div>
  </main>
</template>
<style scoped>
.certificate-page {
  min-height: calc(100vh - 62px);
  background: #edf1f3;
  display: grid;
  align-items: center;
  justify-items: center;
  padding: 40px 16px;
}
.certificate-wrap {
  width: min(720px, 100%);
}
.paper {
  background: white;
  padding: 14px;
  border: 1px solid #e1e5e8;
  border-radius: 8px;
  box-shadow: 0 12px 38px #33415515;
}
.border {
  border: 1px solid #77ae9d;
  padding: 24px 32px;
}
.paper header {
  text-align: center;
  border-bottom: 1px dashed #dce1e4;
  padding-bottom: 24px;
}
.paper header .inline {
  justify-content: center;
  letter-spacing: 2px;
  color: #626c77;
  font-size: 13px;
}
.paper h1 {
  font-size: 30px;
  letter-spacing: 5px;
  margin: 18px 0 1px;
}
.paper header p {
  letter-spacing: 3px;
  color: #9aa1aa;
  font-size: 12px;
}
.paper dl {
  display: grid;
  grid-template-columns: 1.25fr 1fr;
  margin: 26px 0 32px;
  gap: 14px 20px;
}
.paper dl div {
  display: flex;
  gap: 12px;
}
.paper dt {
  color: var(--muted);
  min-width: 87px;
}
.paper dd {
  margin: 0;
}
.paper dl div:first-child dd {
  font-weight: 700;
}
.paper dl div:last-child {
  grid-column: 1/-1;
}
.paper footer {
  display: flex;
  align-items: flex-end;
  gap: 16px;
}
.paper footer p {
  flex: 1;
  font-size: 12px;
  line-height: 1.9;
}
.paper footer img {
  width: 92px;
  height: 92px;
}
.stamp {
  color: #bb5754;
  border: 2px solid #bd5855;
  border-radius: 50%;
  width: 96px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  transform: rotate(-10deg);
  letter-spacing: 2px;
}
.stamp small {
  font-size: 10px;
  color: inherit;
}
.certificate-wrap > .actions {
  justify-content: center;
  margin-top: 16px;
}
@media (max-width: 650px) {
  .border {
    padding: 18px 12px;
  }
  .paper dl {
    grid-template-columns: 1fr;
  }
  .paper footer {
    flex-wrap: wrap;
  }
  .paper footer p {
    flex-basis: 100%;
  }
}
@media print {
  .certificate-wrap > .actions,
  :global(.topnav),
  :global(.toast) {
    display: none;
  }
  .certificate-page {
    min-height: auto;
    background: white;
    padding: 0;
  }
  .paper {
    box-shadow: none;
  }
  .certificate-wrap {
    width: 100%;
  }
}
</style>
