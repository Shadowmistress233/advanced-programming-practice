<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { info } from '../feedback'
const route = useRoute(),
  club = computed(() => route.path === '/club')
const groups = computed(() =>
  club.value
    ? [
        [
          '捐赠管理',
          [
            ['待审核捐赠', '/club', '3'],
            ['捐赠台账', ''],
            ['凭证管理', '/certificate'],
          ],
        ],
        [
          '社团事务',
          [
            ['物资去向公示', ''],
            ['活动报名', '/market'],
            ['统计报表', ''],
          ],
        ],
      ]
    : [
        [
          '运营',
          [
            ['数据看板', '/admin'],
            ['物品审核', '/admin/review', '12'],
            ['举报处理', '', '3'],
          ],
        ],
        [
          '配置',
          [
            ['分类与字典', ''],
            ['积分规则', ''],
            ['活动管理', '/market'],
          ],
        ],
        ['安全', [['操作日志', '']]],
      ],
)
</script>
<template>
  <aside class="worknav">
    <RouterLink class="brand" to="/login" title="返回角色选择"
      ><span class="logo">{{ club ? '爱' : '管' }}</span
      >{{ club ? '爱心社 · 工作台' : '平台管理台' }}</RouterLink
    >
    <section v-for="[title, links] in groups" :key="title">
      <small>{{ title }}</small>
      <template v-for="[label, url, count] in links" :key="label">
        <RouterLink v-if="url" :to="url" class="side-link" :class="{ active: route.path === url }"
          >{{ label }}<span v-if="count" class="tag rose">{{ count }}</span></RouterLink
        >
        <button v-else class="side-link" @click="info(label, '当前设计稿仅展示此菜单入口。')">
          {{ label }}<span v-if="count" class="tag gold">{{ count }}</span>
        </button>
      </template>
    </section>
  </aside>
</template>
