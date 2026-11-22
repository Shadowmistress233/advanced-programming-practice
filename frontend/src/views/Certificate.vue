<script setup>
import { ref, watch } from 'vue'
import { Award, Download, Printer, SearchCheck, ShieldAlert, ShieldCheck } from '@lucide/vue'
import { get, download, useAction } from '../api'
import { useRoute } from 'vue-router'
import certificateQrUrl from '../assets/certificate-code.png'

const route = useRoute(),
  no = ref(route.query.certificateNo || ''),
  result = ref(null),
  { busy, issue, run } = useAction()
function verify() {
  run(async () => {
    result.value = null
    result.value = await get('/donations/verify', { certificateNo: no.value })
  })
}
function printPage() {
  window.print()
}
watch(
  () => route.query.certificateNo,
  (val) => {
    if (val) {
      no.value = val
      verify()
    }
  },
)
if (no.value) verify()
</script>
<template>
  <main class="wrap live">
    <header class="page-title"><h1>捐赠凭证</h1></header>
    <form class="panel verify-bar" @submit.prevent="verify">
      <label class="field verify-input">
        <span>凭证编号</span>
        <input v-model="no" required placeholder="输入捐赠凭证编号（如 CLD2026119K4M7X2P）" />
      </label>
      <button class="primary" :disabled="busy">
        <SearchCheck :size="15" :stroke-width="1.8" />
        <span>查询验真</span>
      </button>
    </form>

    <section v-if="result" class="cert-card">
      <header class="cert-head">
        <div class="cert-brand">
          <Award :size="20" :stroke-width="1.8" />
          <div>
            <b>中南大学 · 校园闲置公益捐赠电子凭证</b>
            <small>CAMPUS LOOP PUBLIC WELFARE DONATION CERTIFICATE</small>
          </div>
        </div>
        <span class="tag cert-status" :class="result.valid ? 'mint' : 'rose'">
          <ShieldCheck v-if="result.valid" :size="14" :stroke-width="2" />
          <ShieldAlert v-else :size="14" :stroke-width="2" />
          <span>{{ result.valid ? '验真有效' : '无效凭证' }}</span>
        </span>
      </header>

      <div v-if="result.valid" class="cert-body">
        <dl class="cert-fields">
          <div>
            <dt>凭证编号</dt>
            <dd class="mono">{{ result.certificateNo }}</dd>
          </div>
          <div>
            <dt>捐赠物品</dt>
            <dd>{{ result.itemTitle }}</dd>
          </div>
          <div>
            <dt>捐赠人（脱敏）</dt>
            <dd>{{ result.donorMasked }}</dd>
          </div>
          <div>
            <dt>接收公益社团</dt>
            <dd>{{ result.clubName }}</dd>
          </div>
          <div class="full-span">
            <dt>审核入库时间</dt>
            <dd class="mono">{{ result.auditTime }}</dd>
          </div>
        </dl>

        <aside class="cert-verify-box">
          <div class="cert-seal" aria-hidden="true">
            <span>中南大学</span>
            <b>{{ result.clubName }}</b>
            <small>公益核验章</small>
          </div>
          <img :src="certificateQrUrl" width="112" height="112" alt="捐赠凭证验真二维码" />
          <small>扫码核验真伪 · 仅公开脱敏信息</small>
        </aside>
      </div>

      <p v-else class="cert-invalid">
        未查询到编号为「{{ result.certificateNo }}」的有效捐赠记录，请核对凭证编号后重试。
      </p>

      <footer class="cert-foot">
        <small>本电子凭证由校园循环平台自动生成，物品流向将由接收社团在台账中持续公示。</small>
        <div class="actions">
          <button
            v-if="route.params.id && result.valid"
            class="primary"
            :disabled="busy"
            @click="run(() => download('/donations/' + route.params.id + '/certificate', '捐赠凭证.pdf'))"
          >
            <Download :size="15" :stroke-width="1.8" />
            <span>下载完整 PDF</span>
          </button>
          <button type="button" @click="printPage">
            <Printer :size="15" :stroke-width="1.8" />
            <span>打印凭证</span>
          </button>
        </div>
      </footer>
    </section>

    <p v-if="issue" role="alert" class="error">{{ issue }}</p>
  </main>
</template>

<style scoped>
.verify-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
  width: 100%;
  max-width: 860px;
  margin-inline: auto;
}
.verify-input {
  flex: 1 1 320px;
}
.cert-card {
  width: 100%;
  max-width: 860px;
  margin-inline: auto;
  background: #fffdf8;
  border: 2px solid #303e82;
  border-radius: 10px;
  padding: 6px;
  box-shadow: 0 8px 24px rgba(25, 31, 61, 0.08);
}
.cert-head,
.cert-body,
.cert-foot {
  border-left: 1px solid #d5d0c0;
  border-right: 1px solid #d5d0c0;
}
.cert-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px;
  background: #303e82;
  color: #ffffff;
  border: 0;
  border-radius: 6px 6px 0 0;
}
.cert-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cert-brand b {
  display: block;
  font-size: 16px;
  letter-spacing: 0.02em;
}
.cert-brand small {
  display: block;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: #d5dcf5;
  margin-top: 2px;
}
.cert-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 600;
}
.cert-body {
  display: grid;
  grid-template-columns: 1fr 196px;
  gap: 24px;
  padding: 24px 22px;
  border-top: 1px solid #e6e2d6;
  background: #ffffff;
}
.cert-fields {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 20px;
  align-content: start;
}
.cert-fields dt {
  font-size: 12.5px;
  color: var(--muted);
  margin-bottom: 4px;
}
.cert-fields dd {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
}
.cert-fields .mono {
  font-variant-numeric: tabular-nums;
}
.cert-fields .full-span {
  grid-column: 1 / -1;
}
.cert-verify-box {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 12px;
  border: 1px dashed #cdc7b5;
  border-radius: 8px;
  background: #faf8f2;
  text-align: center;
}
.cert-verify-box img {
  display: block;
  padding: 4px;
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 4px;
  image-rendering: pixelated;
}
.cert-verify-box > small {
  font-size: 11.5px;
  color: var(--muted);
}
.cert-seal {
  position: absolute;
  top: -12px;
  right: -12px;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 2px solid rgba(180, 35, 47, 0.72);
  background: rgba(255, 255, 255, 0.92);
  color: #b4232f;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transform: rotate(-14deg);
  pointer-events: none;
  box-shadow: 0 2px 6px rgba(180, 35, 47, 0.08);
}
.cert-seal span {
  font-size: 9px;
}
.cert-seal b {
  font-size: 10px;
  line-height: 1.2;
}
.cert-seal small {
  font-size: 8.5px;
}
.cert-invalid {
  padding: 24px 22px;
  background: #ffffff;
  color: #b4232f;
}
.cert-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 22px;
  background: #f8f6ef;
  border-top: 1px solid #e6e2d6;
  border-bottom: 1px solid #d5d0c0;
  border-radius: 0 0 6px 6px;
}
.cert-foot small {
  color: var(--muted);
}
@media (max-width: 700px) {
  .cert-body {
    grid-template-columns: 1fr;
  }
}
</style>
