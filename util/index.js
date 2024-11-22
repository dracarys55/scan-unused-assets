const fs = require('fs')
const path = require('path')

const { glob } = require('glob')
const babelParser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const { parse } = require('jsonc-parser')
const tsConfigPaths = require('tsconfig-paths')

const colors = require('./constant')

/**
 * 判斷是否為 TypeScript 專案
 * @returns {boolean} - 返回是否為 TypeScript 專案
 */
const isTypeScriptProject = () => {
  const projectRoot = process.cwd()

  // 檢查是否存在 tsconfig.json
  const tsConfigPath = path.join(projectRoot, 'tsconfig.json')
  if (fs.existsSync(tsConfigPath)) {
    try {
      require.resolve('typescript') // 嘗試檢測 typescript 是否安裝
      console.log('該專案為 TypeScript 專案，並且已安裝 TypeScript 庫。')
      return true
    } catch (error) {
      console.error('該專案為 TypeScript 專案，但未安裝 TypeScript 庫！請運行：npm install typescript')
      return false
    }
  }

  // 檢查是否有 .ts 或 .tsx 文件
  const files = fs.readdirSync(projectRoot)
  const hasTsFiles = files.some((file) => file.endsWith('.ts') || file.endsWith('.tsx'))

  if (hasTsFiles) {
    try {
      require.resolve('typescript') // 嘗試檢測 typescript 是否安裝
      console.log('該專案包含 TypeScript 文件，並且已安裝 TypeScript 庫。')
      return true
    } catch (error) {
      console.error('該專案包含 TypeScript 文件，但未安裝 TypeScript 庫！請運行：npm install typescript')
      return false
    }
  }

  console.log('該專案不是 TypeScript 專案。')
  return false
}

// 動態加載 TypeScript
const isTS = isTypeScriptProject()
let ts
if (isTS) {
  try {
    ts = require('typescript')
    console.log('TypeScript 模塊已加載，準備執行相關邏輯。')
  } catch (error) {
    console.error('TypeScript 庫未安裝！請運行：npm install typescript')
    process.exit(1)
  }
} else {
  console.log('該專案未使用 TypeScript，跳過加載 TypeScript 模塊。')
}

/**
 * 查找並解析 tsconfig 或 jsconfig
 * @param {string} projectRoot - 專案根目錄
 * @returns {object} - 返回解析的配置和匹配函數
 */
const findAndParseConfig = (projectRoot) => {
  const tsConfigPath = path.join(projectRoot, 'tsconfig.json')
  const jsConfigPath = path.join(projectRoot, 'jsconfig.json')

  let configPath = null
  let configName = null

  // 確定配置文件類型
  if (fs.existsSync(tsConfigPath)) {
    configPath = tsConfigPath
    configName = 'tsconfig.json'
  } else if (fs.existsSync(jsConfigPath)) {
    configPath = jsConfigPath
    configName = 'jsconfig.json'
  }

  if (!configPath) {
    console.log(`${colors.FgYellow}未發現 tsconfig.json 或 jsconfig.json，跳過別名解析。${colors.Reset}`)
    return { config: null, matchPath: null }
  }

  // 讀取並解析配置文件
  const configContent = fs.readFileSync(configPath, 'utf-8')
  const config = parse(configContent)
  if (!config.compilerOptions) {
    throw new Error(`${configName} 中未找到 compilerOptions 配置`)
  }

  const baseUrl = path.resolve(projectRoot, config.compilerOptions.baseUrl || './')
  const paths = config.compilerOptions.paths || {}

  // 建立匹配函數
  const matchPath = tsConfigPaths.createMatchPath(baseUrl, paths)
  console.log(`${colors.FgGreen}解析 ${configName} 成功，處理別名路徑。${colors.Reset}`)

  return { config, matchPath, baseUrl }
}

// 將 glob 轉為 Promise 以便使用 async/await
const globPromise = (pattern, options) => glob(pattern, options)

// 將總大小轉換為可讀格式
const formatSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/**
 * 查找 tsconfig.json 或 jsconfig.json
 * @param {string} projectRoot - 項目根目錄路徑
 * @returns {Object} - 包含 configPath 和 configName 的對象
 * @throws {Error} - 如果找不到任何配置文件
 */
const findConfigPath = (projectRoot) => {
  const configFiles = ['tsconfig.json', 'jsconfig.json']

  for (const file of configFiles) {
    const configPath = path.join(projectRoot, file)
    if (fs.existsSync(configPath)) {
      return { configPath, configName: file }
    }
  }

  // 如果都找不到，拋出錯誤
  throw new Error(`${colors.FgRed}tsconfig.json 或 jsconfig.json 不存在，無法繼續執行${colors.Reset}`)
}

// 提取字符串字面量（使用 Babel 解析器）
const extractStringLiteralsWithBabel = (content) => {
  const stringLiterals = []
  try {
    const ast = babelParser.parse(content, {
      sourceType: 'module',
      plugins: [
        'jsx',
        'typescript',
        'decorators-legacy',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'dynamicImport',
        'optionalChaining',
        'nullishCoalescingOperator',
        'objectRestSpread',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'numericSeparator',
        'bigInt',
        'importMeta',
        'topLevelAwait',
      ],
    })

    traverse(ast, {
      StringLiteral({ node }) {
        stringLiterals.push(node.value)
      },
      TemplateElement({ node }) {
        stringLiterals.push(node.value.raw)
      },
      ImportDeclaration({ node }) {
        if (node.source && node.source.value) {
          stringLiterals.push(node.source.value)
        }
      },
      CallExpression({ node }) {
        if (node.callee.type === 'Import' && node.arguments.length === 1) {
          const arg = node.arguments[0]
          if (arg.type === 'StringLiteral') {
            stringLiterals.push(arg.value)
          }
        }
      },
    })
  } catch (e) {
    console.error(`${colors.FgRed}Babel 解析錯誤：${e.message}${colors.Reset}`)
  }
  return stringLiterals
}

// 提取字符串字面量（使用 TypeScript 編譯器 API）
const extractStringLiteralsWithTS = (content, scriptKind) => {
  const stringLiterals = []
  try {
    const ast = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true, scriptKind)

    const extract = (node) => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        stringLiterals.push(node.text)
      } else if (ts.isTemplateExpression(node)) {
        if (node.head.text) {
          stringLiterals.push(node.head.text)
        }
        node.templateSpans.forEach((span) => {
          if (span.literal.text) {
            stringLiterals.push(span.literal.text)
          }
        })
      }
      ts.forEachChild(node, extract)
    }

    extract(ast)
  } catch (e) {
    console.error(`${colors.FgRed}TypeScript 解析錯誤：${e.message}${colors.Reset}`)
  }
  return stringLiterals
}

// 異步篩選函數，分批處理以避免阻塞事件循環
const asyncFilter = async (array, predicate, batchSize = 50) => {
  const results = []
  for (let i = 0; i < array.length; i += batchSize) {
    const batch = array.slice(i, i + batchSize)
    for (const item of batch) {
      if (await predicate(item)) {
        results.push(item)
      }
    }
    // 讓事件循環有機會處理其他任務
    await new Promise((resolve) => setImmediate(resolve))
  }
  return results
}

// 封裝處理代碼文件的函數
const processCodeFiles = async (codeFiles, spinnerProcess, projectRoot) => {
  const allStringLiterals = new Set()

  for (const [index, codeFile] of codeFiles.entries()) {
    // 每處理 100 個文件更新一次 Spinner 信息
    if (index % 100 === 0) {
      spinnerProcess.updateMessage(
        `[${index + 1}/${codeFiles.length}] 正在解析：${path.relative(projectRoot, codeFile)}`
      )
    }

    try {
      const content = await fs.promises.readFile(codeFile, 'utf-8')
      const ext = path.extname(codeFile).toLowerCase()

      let stringLiterals = []
      if (ext === '.ts' || ext === '.tsx') {
        const scriptKind = ext === '.ts' ? ts.ScriptKind.TS : ts.ScriptKind.TSX
        stringLiterals = extractStringLiteralsWithTS(content, scriptKind)
      } else {
        stringLiterals = extractStringLiteralsWithBabel(content)
      }

      // 將字符串字面量添加到集合中
      stringLiterals.forEach((str) => allStringLiterals.add(str))
    } catch (e) {
      console.error(
        `${colors.FgRed}解析文件出錯：${path.relative(projectRoot, codeFile)} - ${e.message}${colors.Reset}`
      )
    }
  }

  return allStringLiterals
}

// 封裝計算未使用圖片總大小的函數
const calculateTotalSize = async (unusedImages) => {
  let totalSize = 0
  const totalImages = unusedImages.length
  const batchSize = 50 // 定義每批處理的文件數量

  for (let i = 0; i < totalImages; i += batchSize) {
    const batch = unusedImages.slice(i, i + batchSize)

    // 同時處理一批圖片文件
    const stats = await Promise.all(
      batch.map((image) =>
        fs.promises
          .stat(image)
          .then((stat) => stat.size)
          .catch((e) => {
            console.error(`${colors.FgYellow}無法獲取文件大小：${image} - ${e.message}${colors.Reset}`)
            return 0
          })
      )
    )

    // 累加大小
    stats.forEach((size) => {
      totalSize += size
    })

    // 讓事件循環有機會處理其他任務
    await new Promise((resolve) => setImmediate(resolve))
  }

  return totalSize
}

module.exports = {
  isTypeScriptProject,
  findAndParseConfig,
  globPromise,
  formatSize,
  findConfigPath,
  asyncFilter,
  processCodeFiles,
  calculateTotalSize,
}
