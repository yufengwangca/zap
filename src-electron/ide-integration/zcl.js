/**
 *
 *    Copyright (c) 2020 Silicon Labs
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

/**
 * This module provides the API to access zcl specific information.
 *
 * @module REST API: user data
 */

const queryPackage = require('../db/query-package.js')
const queryZcl = require('../db/query-zcl.js')
const dbEnum = require('../../src-shared/db-enum.js')
const sdkExt = require('../generator/helper-sdkextension.js')

/**
 * Return a list of component Ids required by a specific cluster
 *
 * @param {*} db
 * @returns callback for the express uri registration
 */
function getComponentIdsByCluster(db, sessionId, clusterId, side) {
  // enable components
  let packageId = undefined
  let extensions = undefined
  return queryPackage
    .getSessionPackagesByType(
      db,
      sessionId,
      dbEnum.packageType.genTemplatesJson
    )
    .then((pkgs) => {
      return pkgs.length == 0 ? null : pkgs[0].id
    })
    .then((id) => {
      packageId = id
      return queryPackage.selectPackageExtension(
        db,
        id,
        dbEnum.packageExtensionEntity.cluster
      )
    })
    .then((ext) => {
      extensions = ext
      return queryZcl.selectClusterById(db, clusterId, packageId)
    })
    .then((cluster) => {
      let componentIds = []
      side.forEach((zclRole) => {
        let clusterKey = `${cluster.label.toLowerCase()}-${zclRole}`
        let ids = sdkExt.cluster_extension_obj(
          extensions,
          'component',
          clusterKey
        )
        if (ids) {
          ids = ids.split(',').map((x) => x.trim())
          componentIds = componentIds.concat(ids)
        }
      })

      return Promise.resolve({
        id: componentIds,
        clusterId: cluster.id,
        clusterLabel: cluster.label.toLowerCase(),
        side,
      })
    })
    .catch((err) => {
      console.log(
        `Failed to retrieve component dependency by clusterId(${clusterId})`,
        err
      )
    })
}

exports.getComponentIdsByCluster = getComponentIdsByCluster
