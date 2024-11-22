#!/usr/bin/env node
const path = require('path')

const Spinner = require('../util/spinner')
const colors = require('../util/constant')
const {
  globPromise,
  formatSize,
  asyncFilter,
  processCodeFiles,
  calculateTotalSize,
  findAndParseConfig,
} = require('../util')

// 主異步函數
;(async () => {
  try {
    // 獲取項目根目錄
    const projectRoot = process.cwd()

    // 獲取命令行參數
    const args = process.argv.slice(2)
    const targetFolder = args[0] || '' // 如果未提供參數，預設為空

    // 定義要掃描的文件模式
    const codeFolderPattern = targetFolder ? path.join(targetFolder, '**/*.{js,jsx,ts,tsx}') : '**/*.{js,jsx,ts,tsx}'
    const imageFolderPattern = targetFolder
      ? path.join(targetFolder, '**/*.{png,jpg,jpeg,svg,ico}')
      : 'public/**/*.{png,jpg,jpeg,svg,ico}'

    // 初始化 Spinner
    const spinnerInit = new Spinner('初始化掃描腳本...', 'FgBlue')
    spinnerInit.start()

    // 建立 matchPath 函數
    const { matchPath, baseUrl } = findAndParseConfig(projectRoot)

    // 更新 Spinner 信息，開始查找圖片文件
    spinnerInit.updateMessage('正在查找圖片文件...')

    // 獲取所有圖片文件
    const imageFiles = await globPromise(imageFolderPattern, { nodir: true })

    // 停止 Spinner 並顯示結果
    spinnerInit.stop(true)
    console.log(`${colors.FgGreen}找到 ${imageFiles.length} 個圖片文件${colors.Reset}`)

    // 初始化 Spinner，開始查找代碼文件
    const spinnerCode = new Spinner('正在查找代碼文件...', 'FgYellow')
    spinnerCode.start()

    // 獲取所有代碼文件
    const codeFiles = await globPromise(codeFolderPattern, {
      nodir: true,
      ignore: ['node_modules/**', 'dist/**'],
    })

    // 停止 Spinner 並顯示結果
    spinnerCode.stop(true)
    console.log(`${colors.FgGreen}找到 ${codeFiles.length} 個代碼文件${colors.Reset}`)

    // 開始提取所有程式碼路徑
    const spinnerProcess = new Spinner(`正在處理 ${codeFiles.length} 個程式碼文件...`, 'FgBlue')
    spinnerProcess.start()

    // 提取所有字符串字面量
    const allStringLiterals = await processCodeFiles(codeFiles, spinnerProcess, projectRoot)

    // 完成代碼文件處理
    spinnerProcess.stop(true)
    console.log(`${colors.FgGreen}代碼文件解析完成。${colors.Reset}`)

    // 初始化 Spinner 進行大小計算
    const spinnerSize = new Spinner('正在計算未使用圖片的列表與總大小...', 'FgBlue')
    spinnerSize.start()

    // 異步篩選未使用的圖片文件, 使用同步操作會阻塞事件循環, 導致 spinner 無法顯示
    const unusedImages = await asyncFilter(
      imageFiles,
      (imageFile) => {
        const relativeImagePath = path.relative(projectRoot, imageFile).replace(/^public[\\/]/, '')
        let resolvedPath = relativeImagePath
        const matchedPath = matchPath(relativeImagePath)
        if (matchedPath) {
          resolvedPath = path.relative(projectRoot, path.resolve(baseUrl, matchedPath)).replace(/\\/g, '/')
        } else {
          resolvedPath = relativeImagePath.replace(/\\/g, '/')
        }

        const imageName = path.basename(imageFile)
        const possiblePaths = [resolvedPath, `/${resolvedPath}`, imageName]

        // 檢查是否在字符串字面量中被引用
        return !possiblePaths.some(
          (p) => allStringLiterals.has(p) || Array.from(allStringLiterals).some((str) => str.includes(p))
        )
      },
      50
    ) // 每批 50 個文件

    const totalSize = await calculateTotalSize(unusedImages)

    // 停止 Spinner
    spinnerSize.stop(true)

    // 輸出結果
    console.log(`${colors.FgGreen}\n未使用的圖片文件：${colors.Reset}`)
    unusedImages.forEach((image) => console.log(`${colors.FgRed}${image}${colors.Reset}`))
    console.log(`${colors.FgGreen}\n未使用圖片的總大小：${formatSize(totalSize)}${colors.Reset}`)
  } catch (error) {
    console.error(`${colors.FgRed}腳本執行出錯：${error.message}${colors.Reset}`)
    process.exit(1)
  }
})()
