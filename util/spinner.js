const colors = require('./constant')

// 定義 Spinner 類別
class Spinner {
  constructor(message, color = 'FgBlue') {
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    this.index = 0
    this.color = color
    this.message = message
    this.interval = null
  }

  // 啟動 Spinner
  start() {
    this.interval = setInterval(() => {
      process.stdout.write(`\r${colors[this.color]}${this.frames[this.index]} ${this.message}${colors.Reset}`)
      this.index = (this.index + 1) % this.frames.length
    }, 100)
  }

  // 更新 Spinner 訊息
  updateMessage(newMessage) {
    this.message = newMessage
  }

  // 停止 Spinner
  stop(success = true) {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
      const status = success ? `${colors.FgGreen}✔${colors.Reset}` : `${colors.FgRed}✖${colors.Reset}`
      process.stdout.write(`\r${status} ${this.message}\n`)
    }
  }
}

module.exports = Spinner
