<script setup>
import { reactive } from 'vue'
import { ArrowLeftRight, Bell, Gift, Lock, LogOut, Package, ShieldCheck } from '@lucide/vue'
import { get, post, user, unread, useLoad, useAction, campuses, creditLevelOf } from '../api'
import { useRouter } from 'vue-router'
import LoadState from '../components/LoadState.vue'
import { confirmAction, notify } from '../feedback'

const router = useRouter(),
  form = reactive({ campus: '', college: '' }),
  pw = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const state = useLoad(async () => {
  const data = await get('/users/me')
  form.campus = data.campus
  form.college = data.college
  return data
})
const { busy, issue, run } = useAction()
function save() {
  run(async () => {
    const d = await post('/users/me/profile', form)
    user.value = { ...user.value, ...d }
    await state.reload()
    notify('个人资料已保存')
  })
}
function password() {
  run(async () => {
    if (pw.newPassword !== pw.confirmPassword) throw new Error('两次新密码不一致')
    await post('/users/me/password', pw)
    for (const k in pw) pw[k] = ''
    notify('密码已修改，当前会话保持有效')
  })
}
function logout() {
  confirmAction('退出登录', '确认退出当前账号并返回登录页？', () =>
    run(async () => {
      await post('/auth/logout')
      sessionStorage.removeItem('campus-session')
      user.value = null
      unread.value = 0
      router.replace('/login')
    }),
  )
}
</script>
<template>
  <main class="wrap live profile-live">
    <header class="page-title">
      <h1>个人中心</h1>
      <small>学号、姓名与实名认证状态只读锁定 · 仅允许维护校区与学院资料</small>
    </header>
    <LoadState :state="state" v-slot="{ data }">
      <header class="station profile-hero">
        <div>
          <div class="inline" style="margin-bottom: 4px">
            <span class="tag mint">
              {{ ['未认证', '已实名认证', '认证驳回'][data.authStatus] }}
            </span>
            <small v-if="data.studentNo">学号 {{ data.studentNo }}（只读锁定）</small>
          </div>
          <h1>{{ data.realName || data.username }}</h1>
          <small>{{ data.campus }} · {{ data.college }} · 信用 {{ data.creditScore }}（{{ creditLevelOf(data.creditScore) }}）</small>
        </div>
        <button @click="logout" :disabled="busy">
          <LogOut :size="15" />
          <span>退出登录</span>
        </button>
      </header>

      <div class="actions">
        <RouterLink class="btn" to="/mine"><Package :size="15" /><span>我的闲置</span></RouterLink>
        <RouterLink class="btn" to="/order"><ArrowLeftRight :size="15" /><span>我的流转</span></RouterLink>
        <RouterLink class="btn" to="/donations"><Gift :size="15" /><span>捐赠记录</span></RouterLink>
        <RouterLink class="btn" to="/credit"><ShieldCheck :size="15" /><span>信用档案</span></RouterLink>
        <RouterLink class="btn" to="/messages"><Bell :size="15" /><span>我的消息</span></RouterLink>
      </div>

      <div class="feature">
        <form class="editor panel compact-form" @submit.prevent="save">
          <div class="spread">
            <h2>校园资料</h2>
            <span class="tag ink"><Lock :size="12" /> 实名字段锁定</span>
          </div>
          <label class="field">
            <span>姓名与学号（系统核验只读）</span>
            <input :value="`${data.realName || data.username}（${data.studentNo || '管理账号'}）`" disabled />
          </label>
          <div class="two">
            <label class="field">
              <span>所属校区</span>
              <select v-model="form.campus">
                <option v-for="v in campuses" :key="v">{{ v }}</option>
              </select>
            </label>
            <label class="field">
              <span>学院 / 专业</span>
              <input v-model="form.college" required />
            </label>
          </div>
          <button class="primary" :disabled="busy">保存资料</button>
        </form>

        <form class="editor panel compact-form" @submit.prevent="password">
          <h2>账户安全与改密</h2>
          <label class="field">
            <span>原密码</span>
            <input v-model="pw.oldPassword" type="password" autocomplete="current-password" required placeholder="输入当前密码" />
          </label>
          <div class="two">
            <label class="field">
              <span>新密码（6～20 位）</span>
              <input
                v-model="pw.newPassword"
                type="password"
                autocomplete="new-password"
                required
                minlength="6"
                maxlength="20"
              />
            </label>
            <label class="field">
              <span>确认新密码</span>
              <input v-model="pw.confirmPassword" type="password" autocomplete="new-password" required />
            </label>
          </div>
          <button class="primary" :disabled="busy">修改密码</button>
        </form>
      </div>
    </LoadState>
    <p v-if="issue" role="alert" class="error">{{ issue }}</p>
  </main>
</template>

<style scoped>
.profile-live {
  gap: 14px;
}
.profile-hero {
  padding: 20px 28px;
}
.profile-hero h1 {
  font-size: clamp(26px, 2.8vw, 34px);
}
.compact-form {
  padding: 20px 24px !important;
  gap: 12px;
}
</style>
