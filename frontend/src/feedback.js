import { ref } from 'vue'

export const dialog = ref(null)
export const toast = ref('')
let timer
export function notify(message) {
  toast.value = message
  clearTimeout(timer)
  timer = setTimeout(() => {
    toast.value = ''
  }, 3200)
}
export function info(title, body) {
  dialog.value = { title, body }
}
export function confirmAction(title, body, action, button = '确认') {
  dialog.value = { title, body, action, button }
}
export function accept() {
  const action = dialog.value?.action
  dialog.value = null
  action?.()
}
