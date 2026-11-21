<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { messages, sample, statusColor } from '../data'
import { info, notify } from '../feedback'
import Pager from '../components/Pager.vue'
const router = useRouter(),
  tab = ref('全部'),
  page = ref(1)
const types = [
  ['全部', '全部消息'],
  ['流转', '流转通知'],
  ['审核', '审核结果'],
  ['积分', '积分变动'],
  ['捐赠', '捐赠进展'],
  ['系统', '系统公告'],
]
const list = computed(() => messages.filter((m) => tab.value === '全部' || m.type === tab.value))
const unread = computed(() => [0, 1].filter((id) => !sample.noticesRead.includes(id)))
watch(tab, () => (page.value = 1))
function openMessage(m) {
  if (unread.value.includes(m.id)) sample.noticesRead.push(m.id)
  if (m.path) router.push(m.path)
  else info(m.title, m.body)
}
function readAll() {
  sample.noticesRead = [0, 1]
  notify('全部消息已标为已读')
}
</script>
<template>
  <main class="wrap">
    <div class="heading">
      <div>
        <h1>消息中心</h1>
        <p class="subtitle">未读 {{ unread.length }} 条 · 共 5 类通知</p>
      </div>
      <button @click="readAll">全部标为已读</button>
    </div>
    <div class="inbox">
      <aside class="panel folders">
        <button
          v-for="[key, title] in types"
          class="side-link"
          :class="{ active: tab === key }"
          @click="tab = key"
        >
          {{ title }}<span v-if="key === '全部' && unread.length" class="tag rose">{{ unread.length }}</span>
        </button>
      </aside>
      <div>
        <section class="panel flush">
          <button v-for="m in list.slice((page - 1) * 7, page * 7)" class="message" @click="openMessage(m)">
            <span class="tag" :class="statusColor(m.type)">{{ m.type }}</span>
            <div class="grow">
              <div class="spread">
                <b><i v-if="unread.includes(m.id)" class="unread"></i>{{ m.title }}</b
                ><small>{{ m.time }}</small>
              </div>
              <small>{{ m.body }}</small>
            </div>
          </button>
        </section>
        <Pager v-model:page="page" :total="Math.ceil(list.length / 7)" />
      </div>
    </div>
  </main>
</template>
<style scoped>
.inbox {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.folders {
  padding: 10px;
}
.message {
  width: 100%;
  text-align: left;
  justify-content: flex-start;
  align-items: flex-start;
  font-weight: 400;
  gap: 16px;
  min-height: 72px;
  padding: 16px 20px;
  border: 0;
  border-bottom: 1px solid var(--line);
  border-radius: 0;
}
.message:last-child {
  border: 0;
}
.message small {
  display: block;
  margin-top: 4px;
}
.message .unread {
  margin-right: 5px;
}
.folders .side-link {
  margin: 2px 0;
}
.message .spread small {
  white-space: nowrap;
}
@media (max-width: 760px) {
  .inbox {
    grid-template-columns: 1fr;
  }
  .folders {
    display: flex;
    flex-wrap: wrap;
  }
  .folders .side-link {
    width: auto;
  }
  .message {
    padding: 12px;
    gap: 8px;
  }
}
</style>
