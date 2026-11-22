<script setup>
import { ref } from 'vue'
import { post, user, useAction } from '../api'
import { useRouter } from 'vue-router'
const router = useRouter(),
  role = ref('student'),
  username = ref(''),
  password = ref('')
const { busy, issue, run } = useAction()
function login() {
  run(async () => {
    const data = await post('/auth/login', {
      username: username.value,
      password: password.value,
      role: role.value,
    })
    user.value = data
    sessionStorage.setItem('campus-session', '1')
    await router.replace({ admin: '/admin', club: '/club', student: '/home' }[data.role] || '/home')
  })
}
</script>
<template>
  <main class="entry">
    <div class="entry-poster">
      <img src="../assets/csu-gate.png" alt="绿树环绕的中南大学校门" width="1266" height="844" />
    </div>
    <form @submit.prevent="login">
      <header>
        <h1>登录校园循环</h1>
        <p>中南大学 · 闲置流转与技能互换</p>
      </header>
      <label class="field">
        <span>登录身份</span>
        <select v-model="role">
          <option value="student">学生</option>
          <option value="club">公益社团</option>
          <option value="admin">管理员</option>
        </select>
      </label>
      <label class="field">
        <span>账号</span>
        <input v-model="username" autocomplete="username" required minlength="3" maxlength="30" />
      </label>
      <label class="field">
        <span>密码</span>
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          minlength="6"
          maxlength="20"
        />
      </label>
      <p v-if="issue" role="alert" class="error">{{ issue }}</p>
      <button class="primary" :disabled="busy">登录</button>
      <RouterLink to="/home">先逛逛校园交换站 →</RouterLink>
    </form>
  </main>
</template>
