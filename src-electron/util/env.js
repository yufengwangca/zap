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

const path = require('path')
const os = require('os')
const fs = require('fs')
const pino = require('pino')
const zapBaseUrl = 'http://localhost:'
const zapUrlLog = 'zap.url'

let environmentVariable = {
  logLevel: {
    name: 'ZAP_LOGLEVEL',
    description: 'Sets the log level. If unset, then default is: warn.',
  },
  uniqueStateDir: {
    name: 'ZAP_TEMPSTATE',
    description:
      'If set to 1, then instead of .zap, a unique temporary state directory will be created.',
  },
  stateDir: {
    name: 'ZAP_DIR',
    description:
      'Sets a state directory. Can be overriden by --stateDirectory option. If unset, default is: ~/.zap',
  },
  skipPostGen: {
    name: 'ZAP_SKIP_POST_GENERATION',
    description:
      'If there is a defined post-generation action for zap, you can set this to variable to 1 to skip it.',
  },
}

// Basic environment tie-ins
let pino_logger = pino({
  name: 'zap',
  level: process.env[environmentVariable.logLevel.name] || 'warn', // This sets the default log level. If you set this, to say `sql`, then you will get SQL queries.
  customLevels: {
    sql: 25,
    all: 1,
  },
})

let explicit_logger_set = false
let dbInstance
let httpStaticContent = path.join(__dirname, '../../spa')
let versionObject = null
let applicationStateDirectory = null

function setDevelopmentEnv() {
  global.__statics = path.join('src', 'statics').replace(/\\/g, '\\\\')
  httpStaticContent = path.join(__dirname, '../../spa')
}

function setProductionEnv() {
  global.__statics = path.join(__dirname, 'statics').replace(/\\/g, '\\\\')
  httpStaticContent = path.join('.').replace(/\\/g, '\\\\')
}

function mainDatabase() {
  return dbInstance
}

function resolveMainDatabase(db) {
  return new Promise((resolve, reject) => {
    dbInstance = db
    resolve(db)
  })
}

/**
 * Set the state directory. This method is intended to be called
 * only at the application startup, when CLI args are being parsed.
 * This method honors '~/' being the first characters in its argument.
 *
 * @param {*} path Absolute path. Typically '~/.zap'.
 */
function setAppDirectory(directoryPath) {
  let appDir = directoryPath
  if (directoryPath.startsWith('~/')) {
    appDir = path.join(os.homedir(), directoryPath.substring(2))
  } else {
    appDir = directoryPath
  }
  if (!fs.existsSync(appDir)) {
    fs.mkdirSync(appDir, { recursive: true }, (err) => {
      if (err) throw err
    })
  }
  applicationStateDirectory = appDir
}

/**
 * Returns an app directory. It creates it, if it doesn't exist
 *
 * @returns state directory, which is guaranteed to be already existing
 */
function appDirectory() {
  if (applicationStateDirectory == null) {
    let appDir = path.join(os.homedir(), '.zap')
    if (!fs.existsSync(appDir)) {
      fs.mkdirSync(appDir, { recursive: true }, (err) => {
        if (err) throw err
      })
    }
    applicationStateDirectory = appDir
    return appDir
  }
  return applicationStateDirectory
}

function iconsDirectory() {
  return path.join(__dirname, '../icons')
}

function schemaFile() {
  return path.join(__dirname, '../db/zap-schema.sql')
}

function sqliteFile(filename = 'zap') {
  return path.join(appDirectory(), `${filename}.sqlite`)
}

function sqliteTestFile(id, deleteExistingFile = true) {
  let dir = path.join(__dirname, '../../test/.zap')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir)
  }
  let fileName = path.join(dir, `test-${id}.sqlite`)
  if (deleteExistingFile && fs.existsSync(fileName)) fs.unlinkSync(fileName)
  return fileName
}
/**
 * Returns a version as a single on-line string.
 *
 */
function zapVersionAsString() {
  let vo = zapVersion()
  return `ver. ${vo.version}, featureLevel ${vo.featureLevel}, commit: ${vo.hash} from ${vo.date}`
}

/**
 * Returns the zap version.
 *
 * @returns zap version, which is an object that
 * contains 'version', 'featureLevel', 'hash', 'timestamp' and 'date'
 */
function zapVersion() {
  if (versionObject == null) {
    versionObject = {}
    try {
      let p = require('../../package.json')
      versionObject.version = p.version
      versionObject.featureLevel = p.featureLevel
    } catch (err) {
      logError('Could not retrieve version from package.json')
      versionObject.featureLevel = 0
      versionObject.version = '0.0.0'
    }

    try {
      let ver = require('../../.version.json')
      versionObject.hash = ver.hash
      versionObject.timestamp = ver.timestamp
      versionObject.date = ver.date
    } catch {
      logError('Could not retrieve version from .version.json')
    }
  }
  return versionObject
}

function baseUrl() {
  return zapBaseUrl
}

function logInitStdout() {
  if (!explicit_logger_set) {
    pino_logger = pino()
    explicit_logger_set = true
  }
}

function logHttpServerUrl(port, studioPort) {
  logInfo('HTTP server created: ' + baseUrl() + port)

  if (studioPort) {
    logInfo('Studio integration server: ' + baseUrl() + studioPort)
  }

  fs.writeFileSync(urlLogFile(), baseUrl() + port, function (err) {
    if (err) {
      logError('Unable to log HTTP Server URL to ' + urlLogFile())
    }
  })
}

function urlLogFile(id) {
  return path.join(appDirectory(), zapUrlLog)
}

function logInitLogFile() {
  if (!explicit_logger_set) {
    pino_logger = pino(pino.destination(path.join(appDirectory(), 'zap.log')))
    explicit_logger_set = true
  }
}

// Use this function to log info-level messages
function logInfo(msg) {
  return pino_logger.info(msg)
}

// Use this function to log error-level messages
function logError(msg) {
  return pino_logger.error(msg)
}

// Use this function to log warning-level messages
function logWarning(msg) {
  return pino_logger.warn(msg)
}

// Use this function to log SQL messages.
function logSql(msg) {
  return pino_logger.debug(msg)
}

// Returns true if major or minor component of versions is different.
function isMatchingVersion(versionsArray, providedVersion) {
  let ret = false
  let v2 = providedVersion.split('.')
  versionsArray.forEach((element) => {
    let v1 = element.split('.')
    if (v1.length != 3 || v2.length != 3) return

    if (v1[0] != 'x' && v1[0] != v2[0]) return
    if (v1[1] != 'x' && v1[1] != v2[1]) return
    if (v1[2] != 'x' && v1[2] != v2[2]) return

    ret = true
  })

  return ret
}

/**
 * Returns true if versions of node and electron are matching.
 * If versions are not matching, it  prints out a warhing
 * and returns false.
 *
 * @returns true or false, depending on match
 */
function versionsCheck() {
  let expectedNodeVersion = [
    'v14.x.x',
    'v12.20.x',
    'v12.19.x',
    'v12.18.x',
    'v12.17.x',
    'v12.16.x',
    'v12.15.x',
    'v12.14.x',
  ]
  let expectedElectronVersion = ['9.3.x']
  let nodeVersion = process.version
  let electronVersion = process.versions.electron
  let ret = true
  if (!isMatchingVersion(expectedNodeVersion, nodeVersion)) {
    ret = false
    console.log(`Expected node versions: ${expectedNodeVersion}`)
    console.log(`Provided node version: ${nodeVersion}`)
    console.log(
      'WARNING: you are using different node version than recommended.'
    )
  }
  if (
    electronVersion != null &&
    !isMatchingVersion(expectedElectronVersion, electronVersion)
  ) {
    ret = false
    console.log(`Expected electron version: ${expectedElectronVersion}`)
    console.log(`Provided electron version: ${electronVersion}`)
    console.log(
      'WARNING: you are using different electron version that recommended.'
    )
  }
  return ret
}

exports.setDevelopmentEnv = setDevelopmentEnv
exports.setProductionEnv = setProductionEnv
exports.appDirectory = appDirectory
exports.iconsDirectory = iconsDirectory
exports.schemaFile = schemaFile
exports.sqliteFile = sqliteFile
exports.sqliteTestFile = sqliteTestFile
exports.logInitStdout = logInitStdout
exports.logInitLogFile = logInitLogFile
exports.logInfo = logInfo
exports.logError = logError
exports.logWarning = logWarning
exports.logSql = logSql
exports.httpStaticContent = httpStaticContent
exports.zapVersion = zapVersion
exports.zapVersionAsString = zapVersionAsString
exports.resolveMainDatabase = resolveMainDatabase
exports.mainDatabase = mainDatabase
exports.logHttpServerUrl = logHttpServerUrl
exports.urlLogFile = urlLogFile
exports.baseUrl = baseUrl
exports.versionsCheck = versionsCheck
exports.setAppDirectory = setAppDirectory
exports.environmentVariable = environmentVariable
