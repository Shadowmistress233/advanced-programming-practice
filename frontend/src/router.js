import { createRouter, createWebHashHistory } from 'vue-router'

import { get, user } from './api'
import { notify } from './feedback'

const screens = [
  ['/login', '登录', 'Login'],
  ['/home', '首页', 'Home'],
  ['/search', '搜索与筛选', 'Search'],
  ['/item/:id', '物品详情', 'ItemDetail'],
  ['/publish', '发布物品', 'Publish'],
  ['/mine', '我的闲置', 'Mine'],
  ['/exchange/:id', '发起交换', 'Exchange'],
  ['/order/:id?', '流转单详情', 'Order'],
  ['/appointment/:id', '预约面交', 'Appointment'],
  ['/skills', '技能大厅', 'Skills'],
  ['/skill/:id', '技能详情', 'SkillDetail'],
  ['/donate/:id', '捐赠申请', 'Donate'],
  ['/donations', '我的捐赠', 'Review'],
  ['/admin/reports', '工单处理', 'AdminOperations'],
  ['/admin/dicts', '业务字典', 'AdminOperations'],
  ['/admin/logs', '操作日志', 'AdminOperations'],
  ['/club', '捐赠审核台', 'Review'],
  ['/credit', '信用档案', 'Credit'],
  ['/messages', '消息中心', 'Messages'],
  ['/admin', '数据看板', 'Dashboard'],
  ['/admin/review', '后台审核', 'Review'],
  ['/market/:id?', '换物集市', 'Market'],
  ['/profile', '个人中心', 'Profile'],
  ['/certificate/:id?', '捐赠凭证', 'Certificate'],
]
const views = import.meta.glob('./views/*.vue')
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/login' },
    ...screens.map(([path, title, view]) => ({
      path: path.replace(':id', ':id([1-9][0-9]*)'),
      name: title,
      component: views['./views/' + view + '.vue'],
      meta: { title },
    })),
    { path: '/:pathMatch(.*)*', redirect: '/login' },
  ],
  scrollBehavior: (to, from) => (to.path === from.path ? false : { top: 0 }),
})
const publicRoutes = ['登录', '首页', '搜索与筛选', '物品详情', '技能大厅', '换物集市', '捐赠凭证']
router.beforeEach(async (to) => {
  if (to.path === '/login') return true
  const isPublic = publicRoutes.includes(to.name)
  if (!user.value && (!isPublic || sessionStorage.getItem('campus-session'))) {
    try {
      const profile = await get('/users/me')
      user.value = { ...profile, userId: profile.userId ?? profile.id }
    } catch (error) {
      notify(error.message)
      if (!isPublic) return '/login'
    }
  }
  if (
    (to.path.startsWith('/admin') && user.value?.role !== 'admin') ||
    (to.path === '/club' && !['admin', 'club'].includes(user.value?.role))
  ) {
    notify('当前身份无权进入该工作台')
    return '/home'
  }
})
router.afterEach((to) => {
  document.title = to.meta.title + ' · 校园循环'
})
