const https = require('https')
const fs = require('fs')

const logger = require('agathias')
const cheerio = require('cheerio')

const BASE_URL = 'https://2017.spaceappschallenge.org'
const OUTPUT_FILE = `${__dirname}/README.md`

function createMarkdown (categories = []) {
  const headers = [
    '# NASA Space Apps Challenge 2017\n\n',
    '> April 29th - 30th\n\n'
  ]

  let text = headers.reduce((text, header) => {
    text += header;

    return text;
  }, '');

  text = categories.reduce((text, category) => {
    text += `## ${category.title}\n\n`;

    text = category.data.reduce((text, challenge) => {
      text += `### ${challenge.title}\n\n`

      if (challenge.statement) {
        text += `> ${challenge.statement}\n\n`
      }

      text += `![${challenge.title}](${challenge.banner})\n\n`

      text += `${challenge.description}\n\n`;

      return text;
    }, text);

    return text;
  }, text);

  fs.writeFile(OUTPUT_FILE, text, (err) => {
    if (err) logger.error(err)

    logger.info('Success!')
  })
}

function crawlChallenge (challenge) {
  const url = challenge.attribs.href
  logger.debug(`Analyzing Challenge: ${url}`)

  return new Promise((resolve) => {
    https.get(`${BASE_URL}${url}/details`, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        let $ = cheerio.load(data)

        const banner = $('[style^="background"]')[0]
          .attribs
          .style
          .slice(21, -2)
        // logger.debug(`Banner: ${banner}`) // Dev

        const statement = $('[class^="statement"] div')[0]
          .children[0]
          .data
        // logger.debug(`Statement: ${statement}`) // Dev

        const description = $('[class^="statement"] + [class^="container"] p')
          .toArray()
          .reduce((acc, curr) => {
            let data = curr.children.reduce((inAcc, inCurr) => {
              let inData = ''

              if (inCurr.data) {
                inData = inCurr.data
              }

              if (inCurr.name === 'b') {
                inData = inCurr.children[0].data
              }

              inAcc += inData + '\n\n'
              return inAcc
            }, '')

            acc += data
            return acc
          }, '')
        // logger.debug(`Description: ${description}`) // Dev

        resolve({
          url,
          banner,
          statement,
          description,
          title: snakeToTitle(url.split('/')[3]),
          category: snakeToTitle(url.split('/')[2])
        })
      })
    })
  })
}

function crawlCategory (category) {
  logger.debug(`Analyzing Category: ${category.attribs.href}`)

  return new Promise((resolve) => {
    https.get(`${BASE_URL}${category.attribs.href}`, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        let $ = cheerio.load(data)
        Promise
          .all($('[class^="challengesContainer-"] [class^="container-"] > div > a')
            .toArray()
            // .slice(0, 2) // Dev
            .map(crawlChallenge)
          )
          .then((challenges) => {
            resolve({
              title: challenges[0].category,
              data: challenges
            })
          })
      })
    })
  })
}

function crawlCategories () {
  logger.debug('Analyzing challenges')
  https.get(`${BASE_URL}/challenges`, (res) => {
    let data = ''
    res.on('data', (chunk) => {
      data += chunk
    })
    res.on('end', () => {
      let $ = cheerio.load(data)
      Promise
      .all($('[class^="challengesContainer-"] [class^="container-"] > div > a')
        .toArray()
        // .slice(0, 2) // Dev
        .map(crawlCategory)
      )
      .then((categories) => {
        logger.debug(categories)
        createMarkdown(categories)
      })
    })
  })
}

function snakeToTitle (value) {
  return value
    .replace(/-/g, ' ')
    .replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
}

crawlCategories()
