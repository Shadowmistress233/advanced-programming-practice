import { ref, watch, onScopeDispose } from 'vue'
import { notify } from './feedback'
import { MOCK_ENABLED, mockData, mockFile } from './mock'
export {
  campuses,
  conditions,
  itemStates,
  orderStates,
  pickupPoints,
  charityClubs,
  reportTypes,
  creditLevelOf,
} from './constants'

export const user = ref(null)
export const unread = ref(0)
const prefix = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')
export function mediaUrl(value) {
  if (!value) return ''
  const base = new URL(prefix + '/', location.href)
  const url = new URL(value, base)
  return ['https:', 'http:'].includes(url.protocol) ? url.href : ''
}
async function request(path, method, params = {}, format) {
  if (MOCK_ENABLED) return format ? mockFile(path) : mockData(path, method, params)
  const url = new URL(prefix + path, location.href)
  const options = { method, credentials: 'include', cache: 'no-store' }
  if (method === 'GET') {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== '') url.searchParams.set(key, value)
    }
  } else if (params instanceof FormData) options.body = params
  else {
    options.headers = { 'Content-Type': 'application/json' }
    options.body = JSON.stringify(params)
  }
  const response = await fetch(url, options)
  if (!response.ok) throw new Error('服务请求失败（HTTP ' + response.status + '）')
  const type = response.headers.get('content-type') || ''
  if (format && !type.includes('json') && !type.includes('html')) return response.blob()
  if (!type.includes('json')) throw new Error('服务未返回接口数据，请检查后端地址。')
  const result = await response.json()
  if (result.code !== 0) {
    if ([1002, 1005].includes(result.code)) {
      user.value = null
      sessionStorage.removeItem('campus-session')
      unread.value = 0
      if (location.hash !== '#/login') location.hash = '/login'
      notify(result.msg || '请重新登录')
    }
    throw new Error(result.msg || '操作失败（' + result.code + '）')
  }
  if (format) throw new Error('服务未返回所需文件')
  return result.data
}
export const get = (path, params) => request(path, 'GET', params)
export const post = (path, params) => request(path, 'POST', params)
export const file = (path, params) => request(path, 'GET', params, true)
export async function download(path, name, params) {
  const url = URL.createObjectURL(await file(path, params))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
export function useLoad(loader, sources = []) {
  const data = ref(null),
    error = ref(''),
    loading = ref(true)
  let version = 0
  async function reload() {
    const current = ++version
    error.value = ''
    if (data.value == null) loading.value = true
    try {
      const value = await loader()
      if (current === version) data.value = value
    } catch (e) {
      if (current === version) {
        data.value = null
        error.value = e.message
      }
    } finally {
      if (current === version) loading.value = false
    }
  }
  watch(sources, reload, { immediate: true, deep: true })
  onScopeDispose(() => version++)
  return { data, error, loading, reload }
}
export function useAction() {
  const busy = ref(false),
    issue = ref('')
  async function run(task) {
    if (busy.value) return
    busy.value = true
    issue.value = ''
    try {
      await task()
    } catch (e) {
      issue.value = e.message
    } finally {
      busy.value = false
    }
  }
  return { busy, issue, run }
}
export function pageOf(data) {
  return data?.pageInfo ?? (typeof data?.page === 'object' ? data.page : data)
}
export function categoryOptions(tree) {
  return (tree || []).flatMap((c) => [
    c,
    ...(c.children || []).map((child) => ({
      ...child,
      categoryName: c.categoryName + ' / ' + child.categoryName,
    })),
  ])
}
export async function refreshUnread() {
  const current = user.value
  if (current) {
    const result = await get('/messages/unread-count')
    if (current === user.value) unread.value = result.unreadCount
  }
}
