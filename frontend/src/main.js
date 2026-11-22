import { createApp } from 'vue'
import 'misans-vf'
import App from './App.vue'
import { router } from './router'
import './styles.css'

createApp(App).use(router).mount('#app')
