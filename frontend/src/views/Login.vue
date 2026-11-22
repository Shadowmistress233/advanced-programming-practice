<script setup>
import { ref } from 'vue'
import { ArrowRight, GraduationCap, HeartHandshake, Lock, LogIn, ShieldCheck, User } from '@lucide/vue'
import { post, user, useAction } from '../api'
import { useRouter } from 'vue-router'

const router = useRouter(),
  role = ref('student'),
  username = ref(''),
  password = ref('')
const { busy, issue, run } = useAction()

const roles = [
  { key: 'student', label: '学生', icon: GraduationCap, hint: 'student' },
  { key: 'club', label: '公益社团', icon: HeartHandshake, hint: 'club' },
  { key: 'admin', label: '管理员', icon: ShieldCheck, hint: 'admin' },
]

function fillDemo(item) {
  role.value = item.key
  username.value = item.hint
  password.value = '123456'
}

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
    <section class="entry-panel">
      <form class="login-card" @submit.prevent="login">
        <header class="login-brand">
          <span class="logo">循</span>
          <div>
            <h1>校园循环 Campus Loop</h1>
            <p>中南大学 · 闲置流转与技能互换平台</p>
          </div>
        </header>

        <div class="role-tabs" role="tablist" aria-label="选择登录身份">
          <button
            v-for="item in roles"
            :key="item.key"
            type="button"
            role="tab"
            class="role-tab"
            :class="{ active: role === item.key }"
            :aria-selected="role === item.key"
            :data-role="item.key"
            @click="role = item.key"
          >
            <component :is="item.icon" :size="15" :stroke-width="1.9" />
            <span>{{ item.label }}</span>
          </button>
        </div>

        <label class="field">
          <span>账号</span>
          <div class="input-wrap">
            <User :size="16" :stroke-width="1.8" class="input-icon" />
            <input
              v-model="username"
              autocomplete="username"
              placeholder="输入学号 / 工号 / 演示账号"
              required
              minlength="3"
              maxlength="30"
            />
          </div>
        </label>

        <label class="field">
          <span>密码</span>
          <div class="input-wrap">
            <Lock :size="16" :stroke-width="1.8" class="input-icon" />
            <input
              v-model="password"
              type="password"
              autocomplete="current-password"
              placeholder="6～20 位密码"
              required
              minlength="6"
              maxlength="20"
            />
          </div>
        </label>

        <p v-if="issue" role="alert" class="error">{{ issue }}</p>

        <button class="primary submit-btn" :disabled="busy">
          <LogIn :size="16" :stroke-width="1.9" />
          <span>登录校园循环</span>
        </button>

        <div class="demo-box">
          <small>一键填入演示账号（密码 123456）：</small>
          <div class="demo-pills">
            <button
              v-for="item in roles"
              :key="item.key"
              type="button"
              class="demo-pill"
              @click="fillDemo(item)"
            >
              {{ item.label }} {{ item.hint }}
            </button>
          </div>
        </div>

        <RouterLink class="guest-link" to="/home">
          <span>先逛逛校园交换站</span>
          <ArrowRight :size="14" :stroke-width="1.8" />
        </RouterLink>
      </form>
    </section>
  </main>
</template>

<style scoped>
.login-card {
  width: min(416px, 92%);
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 28px 28px 24px;
  box-shadow: 0 12px 32px rgba(31, 36, 51, 0.08);
  display: grid;
  gap: 18px;
}
.login-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.login-brand h1 {
  font-size: 22px;
  line-height: 1.25;
}
.login-brand p {
  margin-top: 2px;
  font-size: 13px;
  color: var(--muted);
}
.role-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 4px;
  background: #f3f1ea;
  border: 1px solid var(--line);
  border-radius: 10px;
}
.role-tab {
  min-height: 36px;
  padding: 0 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #4f5568;
  font-size: 13px;
  font-weight: 500;
}
.role-tab.active {
  background: #ffffff;
  color: #303e82;
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(31, 36, 51, 0.08);
}
.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.input-icon {
  position: absolute;
  left: 12px;
  color: #7a8194;
  pointer-events: none;
}
.input-wrap input {
  padding-left: 38px !important;
}
.submit-btn {
  width: 100%;
  min-height: 44px;
  font-size: 15px;
}
.demo-box {
  padding: 10px 12px;
  border-radius: 9px;
  background: #faf8f2;
  border: 1px dashed #d8d4c7;
  display: grid;
  gap: 8px;
}
.demo-box small {
  font-size: 12px;
}
.demo-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.demo-pill {
  min-height: 28px;
  padding: 0 10px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 500;
  background: #ffffff;
  border: 1px solid #dcd8cb;
  color: #303e82;
}
.demo-pill:hover {
  background: #edf2ff;
  border-color: #303e82;
}
.guest-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  justify-self: center;
  color: var(--accent);
  font-size: 13.5px;
  font-weight: 600;
}
</style>
