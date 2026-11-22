<script setup>
import { reactive } from 'vue'
import { get, post, user, unread, useLoad, useAction, campuses } from '../api'
import { useRouter } from 'vue-router'
import LoadState from '../components/LoadState.vue'
import { notify } from '../feedback'
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
    notify('密码已修改')
  })
}
function logout() {
  run(async () => {
    await post('/auth/logout')
    sessionStorage.removeItem('campus-session')
    user.value = null
    unread.value = 0
    router.replace('/login')
  })
}
</script>
<template>
  <main class="wrap live">
    <header class="page-title"><h1>个人中心</h1></header>
    <LoadState :state="state" v-slot="{ data }">
      <header class="station">
        <div>
          <h1>{{ data.realName || data.username }}</h1>
          <p v-if="data.studentNo">
            学号 {{ data.studentNo }} · {{ ['未认证', '已认证', '认证驳回'][data.authStatus] }}
          </p>
          <p>{{ data.campus }} · {{ data.college }} · 信用 {{ data.creditScore }}</p>
        </div>
        <button @click="logout" :disabled="busy">退出登录</button>
      </header>
      <div class="actions">
        <RouterLink class="btn" to="/mine">我的闲置</RouterLink>
        <RouterLink class="btn" to="/order">我的流转</RouterLink>
        <RouterLink class="btn" to="/donations">捐赠记录</RouterLink>
        <RouterLink class="btn" to="/credit">信用档案</RouterLink>
        <RouterLink class="btn" to="/messages">我的消息</RouterLink>
      </div>
      <div class="feature">
        <form class="editor panel" @submit.prevent="save">
          <h2>校园资料</h2>
          <label class="field">
            <span>校区</span>
            <select v-model="form.campus">
              <option v-for="v in campuses">{{ v }}</option>
            </select>
          </label>
          <label class="field">
            <span>学院</span>
            <input v-model="form.college" required />
          </label>
          <button class="primary" :disabled="busy">保存资料</button>
        </form>
        <form class="editor panel" @submit.prevent="password">
          <h2>账户密码</h2>
          <label class="field">
            <span>原密码</span>
            <input v-model="pw.oldPassword" type="password" autocomplete="current-password" required />
          </label>
          <label class="field">
            <span>新密码</span>
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
          <button class="primary" :disabled="busy">修改密码</button>
        </form>
      </div>
    </LoadState>
    <p v-if="issue" role="alert" class="error">{{ issue }}</p>
  </main>
</template>
