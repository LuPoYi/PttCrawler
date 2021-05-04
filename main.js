process.env.NTBA_FIX_319 = 1

// config
const config = require('./config.json')
const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = config

// lowdb
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const adapter = new FileSync('db.json')
const db = low(adapter)

// cronjob

const CronJob = require('cron').CronJob
const cronExpression = `* * * * *`

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

const host = 'https://www.ptt.cc/'
const targetURL = 'https://www.ptt.cc/bbs/MacShop/search?q=airpods+pro'
const linkListCache = [] // keep 50
let isInitial = true

const crawler = () => {
  console.log('start crawler')
  request.get(targetURL, function (err, res, data) {
    const $ = cheerio.load(data)

    for (let element of $('#main-container .title a')) {
      const link = element?.attribs?.href
      const text = element?.children?.[0]?.data

      if (text.includes('販售')) {
        if (linkListCache.includes(link)) {
          return
        }

        linkListCache.push(link) // add new one

        if (isInitial) {
          continue
        }

        bot.sendMessage(TELEGRAM_CHAT_ID, `${host}${link}`)
        if (linkListCache.length > 49) {
          linkListCache.shift() // remove oldest one
        }
      }
      console.log(link, text)
    }
    isInitial = false
  })
}

console.log(`CronJob Before Set -> ${cronExpression}`)
const job = new CronJob(cronExpression, function () {
  crawler()
})
console.log(`CronJob After Set -> ${cronExpression}`)
job.start()
