<!--
Copyright (c) 2008,2020 Silicon Labs.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

<template>
  <div id="q-app">
    <q-ajax-bar />
    <router-view />
  </div>
</template>

<script>
import Vue from 'vue'
import { QSpinnerGears } from 'quasar'

function initLoad(store) {
  store.dispatch('zap/loadInitialData')
  store.dispatch('zap/loadOptions', {
    key: 'defaultResponsePolicy',
    type: 'string',
  })
  store.dispatch('zap/loadOptions', {
    key: 'manufacturerCodes',
    type: 'object',
  })
  store.dispatch('zap/loadSessionKeyValues')

  let promises = []
  promises.push(
    Vue.prototype.$serverGet('/zcl/cluster/all').then((response) => {
      let arg = response.data
      store.dispatch('zap/updateClusters', arg.data)
    })
  )
  promises.push(
    Vue.prototype.$serverGet('/zcl/deviceType/all').then((response) => {
      let arg = response.data
      store.dispatch('zap/updateZclDeviceTypes', arg.data || [])
    })
  )
  promises.push(store.dispatch(`zap/getProjectPackages`))
  return Promise.all(promises)
}

export default {
  name: 'App',
  methods: {
    setThemeMode(bodyElement) {
      const theme = bodyElement.getAttribute('data-theme')
      if (theme === 'com.silabs.ss.platform.theme.dark') {
        this.$q.dark.set(true)
      } else {
        this.$q.dark.set(false)
      }
    },
  },
  mounted() {
    this.$q.loading.show({
      spinner: QSpinnerGears,
      spinnerColor: 'red-8',
      spinnerSize: 300,
    })

    // Parse the query string into the front end.
    const querystring = require('querystring')
    let search = global.location.search

    if (search[0] === '?') {
      search = search.substring(1)
    }

    let query = querystring.parse(search)
    if (query[`uiMode`]) {
      this.$store.dispatch('zap/setDefaultUiMode', query[`uiMode`])
    }

    if (`embeddedMode` in query) {
      this.$store.dispatch('zap/setEmbeddedMode', query[`embeddedMode`])
    }

    if (query['studioProject']) {
      this.$store.dispatch('zap/setStudioConfigPath', query['studioProject'])
    }

    this.zclDialogTitle = 'ZCL tab!'
    this.zclDialogText = 'Welcome to ZCL tab. This is just a test of a dialog.'
    this.zclDialogFlag = false
    let html = document.documentElement
    this.setThemeMode(html)
    new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'data-theme'
        ) {
          this.setThemeMode(html)
        }
      })
    }).observe(html, {
      attributes: true,
      attributeFilter: ['data-theme'],
      subtree: false,
    })
    initLoad(this.$store).then(() => {
      this.$q.loading.hide()
    })
  },
}
</script>
