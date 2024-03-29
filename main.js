process.env.NTBA_FIX_319 = 1

// config
const config = require('./config.json')
const {
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  CRON_EXPRESSION,
  HOST,
  TARGET_PATH,
  TITLE_SHOULD_INCLUDE_ARRAY,
} = config
const URL = `${HOST}${encodeURI(TARGET_PATH)}`

// lowdb
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const adapter = new FileSync('db.json')
const db = low(adapter)
db.defaults({ executedAt: '', pttLinkCache: [] }).write()

// cronjob
const CronJob = require('cron').CronJob
const cronExpression = `*/5 * * * *`

// telegram bot
const TelegramBot = require('node-telegram-bot-api')
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true })
bot.on('message', (msg) => {
  const chatId = msg.chat.id

  // send a message to the chat acknowledging receipt of their message
  bot.sendMessage(chatId, `Received your message ${msg.text} ${chatId}`)
})

// request & cheerio
const request = require('request')
const cheerio = require('cheerio')

const crawler = () => {
  const executedAt = new Date().toLocaleString('zh-TW')
  console.log('start crawler', executedAt)
  let pttLinkCache = db.get('pttLinkCache').value()
  const isInitial = pttLinkCache.length === 0

  // set cookies
  const cookieJar = request.jar()
  const cookie = request.cookie('over18=1')
  cookieJar.setCookie(cookie, URL)

  const options = {
    url: URL,
    jar: cookieJar,
  }

  request.get(options, (err, res, data) => {
    const $ = cheerio.load(data)

    for (let element of $('#main-container .title a')) {
      const link = element?.attribs?.href
      const text = element?.children?.[0]?.data

      let isInclude = true
      TITLE_SHOULD_INCLUDE_ARRAY.forEach((keyword) => {
        if (!text.includes(keyword)) isInclude = false
      })

      if (isInclude) {
        if (pttLinkCache.includes(link)) break

        pttLinkCache.push(link) // add new one

        if (isInitial) continue

        bot.sendMessage(TELEGRAM_CHAT_ID, `${HOST}${link}`)
        if (pttLinkCache.length > 29) pttLinkCache.shift() // remove oldest one
      }
    }

    db.set('pttLinkCache', pttLinkCache).write()
    db.set('executedAt', executedAt).write()
  })
}

const job = new CronJob(CRON_EXPRESSION, () => crawler())
console.log(`CronJob Start -> ${CRON_EXPRESSION}`)
job.start()
