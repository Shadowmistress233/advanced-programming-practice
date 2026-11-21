import { createRouter, createWebHashHistory } from 'vue-router'

const screens = [
  ['/login', '登录', 'Login'],
  ['/home', '首页', 'Home'],
  ['/search', '搜索与筛选', 'Search'],
  ['/item/:id?', '物品详情', 'ItemDetail'],
  ['/publish', '发布物品', 'Publish'],
  ['/mine', '我的闲置', 'Mine'],
  ['/exchange/:id?', '发起交换', 'Exchange'],
  ['/order', '流转单详情', 'Order'],
  ['/appointment', '预约面交', 'Appointment'],
  ['/skills', '技能大厅', 'Skills'],
  ['/skill/:id?', '技能详情', 'SkillDetail'],
  ['/donate/:id?', '捐赠申请', 'Donate'],
  ['/club', '捐赠审核台', 'Review'],
  ['/credit', '信用档案', 'Credit'],
  ['/messages', '消息中心', 'Messages'],
  ['/admin', '数据看板', 'Dashboard'],
  ['/admin/review', '后台审核', 'Review'],
  ['/market', '换物集市', 'Market'],
  ['/profile', '个人中心', 'Profile'],
  ['/certificate', '捐赠凭证', 'Certificate'],
]
const views = import.meta.glob('./views/*.vue')
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/login' },
    ...screens.map(([path, title, view]) => ({
      path,
      name: title,
      component: views['./views/' + view + '.vue'],
      meta: { title },
    })),
    { path: '/:pathMatch(.*)*', redirect: '/login' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
router.afterEach((to) => {
  document.title = to.meta.title + ' · 校园循环'
})
