<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { info } from '../feedback'
const router = useRouter(),
  role = ref('学生'),
  account = ref('8204210101'),
  password = ref('campusloop'),
  visible = ref(false),
  remember = ref(true)
const entries = { 学生: '/home', 公益社团: '/club', 管理员: '/admin' }
function login() {
  if (remember.value) sessionStorage.setItem('loop-demo-account', account.value)
  else sessionStorage.removeItem('loop-demo-account')
  router.push(entries[role.value])
}
account.value = sessionStorage.getItem('loop-demo-account') || account.value
</script>
<template>
  <main class="login-page">
    <section class="login-story">
      <span class="logo story-logo">循</span>
      <div class="story-center">
        <h1>让闲置<br />在校园里继续流转</h1>
        <p>以物易物、技能互换、闲置快捐，<br />不花一分钱，也能换到你想要的东西。</p>
        <div class="login-metrics">
          <div
            v-for="[n, label] in [
              ['1,284', '在售闲置'],
              ['9,650', '已完成流转'],
              ['3,120', '公益捐出'],
            ]"
            :key="label"
          >
            <b>{{ n }}</b
            ><span>{{ label }}</span>
          </div>
        </div>
      </div>
      <small>中南大学 · 校园闲置互助流转平台</small>
    </section>
    <section class="login-right">
      <form class="login-form" @submit.prevent="login">
        <h1>欢迎回来</h1>
        <p class="subtitle">登录后即可发布、交换与捐赠</p>
        <div class="roles">
          <button
            v-for="r in Object.keys(entries)"
            type="button"
            :class="{ selected: role === r }"
            @click="role = r"
          >
            {{ r }}
          </button>
        </div>
        <label class="field"
          ><span>学号 / 账号</span><input v-model="account" required autocomplete="off"
        /></label>
        <label class="field"
          ><span>密码</span
          ><span class="password"
            ><input
              v-model="password"
              required
              :type="visible ? 'text' : 'password'"
              autocomplete="off"
            /><button type="button" class="plain" @click="visible = !visible">
              {{ visible ? '隐藏' : '显示' }}
            </button></span
          ></label
        >
        <div class="spread">
          <label><input type="checkbox" v-model="remember" /> 记住我</label
          ><button
            type="button"
            class="text"
            @click="info('忘记密码', '此处为角色演示入口，可使用页面预填账号和密码进入。')"
          >
            忘记密码？
          </button>
        </div>
        <button class="primary login-submit">登 录</button>
        <p class="login-help">
          首次登录需完成校园身份认证 ·
          <button type="button" class="text" @click="info('校园身份认证', '本地演示使用已认证的示例身份。')">
            去认证
          </button>
        </p>
        <footer>© 2026 中南大学 · 校园循环</footer>
      </form>
    </section>
  </main>
</template>
<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: #fff;
}
.login-story {
  position: relative;
  overflow: hidden;
  background: linear-gradient(145deg, #108969, #0b574a);
  color: #fff;
  padding: 62px clamp(32px, 4.85vw, 80px) 46px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.login-story::before,
.login-story::after {
  content: '';
  position: absolute;
  border: 1px solid #ffffff13;
  border-radius: 50%;
  width: 405px;
  height: 405px;
  right: -78px;
  bottom: -108px;
  pointer-events: none;
}
.login-story::after {
  width: 250px;
  height: 250px;
  right: 10px;
  bottom: -57px;
}
.story-logo {
  background: #ffffff29;
  width: 40px;
  height: 40px;
  font-size: 20px;
}
.story-center {
  margin: clamp(70px, 10vh, 120px) 0 auto;
}
.story-center h1 {
  font-size: clamp(32px, 2.9vw, 46px);
  line-height: 1.34;
  letter-spacing: -0.035em;
}
.story-center p {
  margin: 22px 0 56px;
  line-height: 1.9;
  color: #e0f4ec;
  font-size: 15px;
}
.login-metrics {
  display: flex;
  gap: 14px;
}
.login-metrics div {
  flex: 1;
  max-width: 150px;
  border: 1px solid #ffffff30;
  background: #ffffff1c;
  border-radius: 14px;
  padding: 15px 21px;
}
.login-metrics b,
.login-metrics span {
  display: block;
}
.login-metrics b {
  font-size: 26px;
}
.login-metrics span,
.login-story > small {
  color: #d3eae2;
}
.login-story > small {
  margin-top: 60px;
}
.login-right {
  display: grid;
  place-items: center;
  padding: 36px;
}
.login-form {
  width: min(380px, 100%);
  position: relative;
}
.login-form {
  transform: translateY(-26px);
}
.login-form h1 {
  font-size: 24px;
}
.roles {
  display: flex;
  background: #f3f4f6;
  border-radius: 11px;
  padding: 4px;
  margin: 26px 0 20px;
}
.roles button {
  flex: 1;
  border: 0;
  background: transparent;
  min-height: 36px;
  font-weight: 500;
  color: #606975;
}
.roles button.selected {
  background: white;
  color: var(--green);
  box-shadow: 0 1px 3px #0001;
  font-weight: 700;
}
.login-form > .field {
  margin: 15px 0;
}
.password {
  position: relative;
}
.password input {
  padding-right: 54px !important;
}
.password button {
  position: absolute;
  right: 14px;
  top: 11px;
  color: #858d96;
}
.login-form input[type='checkbox'] {
  margin: 0;
}
.login-form .spread,
.login-help {
  font-size: 13px;
}
.login-submit {
  width: 100%;
  margin: 22px 0 14px;
  height: 46px;
  font-size: 16px;
}
.login-help,
.login-form footer {
  text-align: center;
  color: #9299a1;
}
.login-form footer {
  position: absolute;
  top: calc(100% + 52px);
  width: 100%;
  font-size: 12px;
}
@media (max-width: 760px) {
  .login-form {
    transform: none;
  }
  .login-page {
    display: block;
  }
  .login-story {
    padding: 24px;
  }
  .story-center {
    margin: 20px 0 0;
  }
  .story-center h1 {
    font-size: 28px;
  }
  .story-center p {
    margin: 10px 0 18px;
  }
  .login-metrics div {
    padding: 8px 14px;
  }
  .login-metrics b {
    font-size: 20px;
  }
  .login-story > small {
    display: none;
  }
  .login-right {
    padding: 28px 24px 70px;
  }
  .login-form footer {
    top: calc(100% + 22px);
  }
}
</style>
