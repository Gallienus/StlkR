const express    = require('express')
const path       = require('path')
const favicon    = require('serve-favicon')
const logger     = require('morgan')
const bodyParser = require('body-parser')
const http       = require('http')

const config = require('./config')
const { index, navbar } = require('./pages.json')

const SocketServer = require('./lib/SocketServer')
const Database = require('./lib/Database')
const Robot = require('./lib/Robot')
const Crawl = require('./lib/Crawl')

const app = express()

app.set('views', path.join(__dirname, 'resources/views'))
app.set('view engine', 'pug')

app.use(favicon(path.join(__dirname, 'resources/public', 'favicon.ico')))
app.use(logger('dev'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static(path.join(__dirname, 'resources/public')))
app.use('/storage', express.static(path.join(__dirname, 'storage')))

app.use('/api', require('./routes/api'))


app.get('/', (req, res, next) => {
    let list = []
    for (let k in index) list.push({ href:k, description:index[k] })
    res.render('index', { links:list })
})

app.get('/user', (req, res, next) => {
    if (req.query.username)
        Database.getFullUser(req.query.username)
            .then(user => res.render('user', { user:user, navbar }))
            .catch(console.log)
    else
        res.render('user', { navbar })
})

app.get('/userSearch', (req, res, next) => {
    res.render('userSearch', { navbar })
})

app.get('/users', (req, res, next) => {
    let sort = req.query.sort, flow = req.query.flow
    Database.query.all(`SELECT * FROM user WHERE id NOT IN (SELECT user_id FROM user_tag WHERE tag = "hidden") ORDER BY ${sort || 'id'} ${flow || 'ASC'}`)
        .then(users => res.render('users', { users, sort, flow, navbar }))
        .catch(console.log)
})

app.get('/post', (req, res, next) => {
    Database.getFullPostByCode(req.query.code)
        .then(post => {
            Database.getContentsByPost(post)
                .then(contents => res.render('post', { post, contents, navbar }))
                .catch(console.log)
        })
        .catch(console.log)
})

app.get('/posts', (req, res, next) => {
    let username = req.query.username, sort = req.query.sort || 'uploaded', flow = req.query.flow || 'DESC'
    if (username)
        Database.getUser(username)
            .then(user => {
                Database.query.all(`SELECT * FROM post WHERE user_id = ? AND saved_content = 1 ORDER BY ${sort} ${flow}`, user.id)
                    .then(posts => res.render('posts', { posts, username, sort, flow, navbar }))
                    .catch(console.log)
            })
            .catch(console.log)
    else
        res.render('posts', { navbar })
})

app.get('/stories', (req, res, next) => {
    let username = req.query.username//, sort = req.query.sort, flow = req.query.flow
    if (username)
        Database.getUser(username)
            .then(user => {
                Database.getAll('story', 'user_id', user.id, '*'/* , sort, flow */)
                    .then(stories => res.render('stories', { stories, user/*, sort, flow*/, navbar }))
            }).catch(console.log)
    else
        res.render('stories', { navbar })
})

app.get('/profilePics', (req, res, next) => {
    let username = req.query.username
    if (username) {
        Database.getProfilePics(username).then(profilePics => {
            res.render('profilePics', { profilePics, navbar })
        }).catch(console.log)
    } else {
        res.render('profilePics', { navbar })
    }
})

app.get('/contents', (req, res, next) => {
    let code = req.query.code, username = req.query.username
    if (code) {
        Database.getPostByCode(code).then(post =>  {
            Database.getContentsByPost(post).then(contents => {
                res.render('contents', { contents, post, navbar })
            }).catch(console.log)
        }).catch(console.log)
    } else if (username) {
        Database.getUser(username).then(user => {
            Database.getContentsByUser(user).then(contents => {
                res.render('contents', { contents, user, navbar })
            }).catch(console.log)
        }).catch(console.log)
    } else {
        res.render('contents', { navbar })
    }
})

app.get('/robot', (req, res, next) => {
    res.render('robot', { status:Robot.getStatus(), paused:Robot.getPaused(), storiesPaused:Robot.getStoriesPaused(), navbar })
})

/* millis + accuracy (1=1 year)     ma
   birth date                       bd
   birth date + accuracy (1=1 year) ba
   start date + stop date           ss
   start millis + stop millis       sm
   age                              ag
   min age + max age                mm */


app.get('/age', (req, res, next) => {
    let action = req.query.action
    if (action === 'set_unknown') {
        let stmt = Database.db.prepare('SELECT * FROM user WHERE id NOT IN (SELECT user_id FROM age)')
        stmt.all((err, users) => {
            res.render('age', { action, users, navbar })
        })
    } else if (action === 'update') {
        let stmt = Database.db.prepare('SELECT user.*, age.* FROM user JOIN age ON age.user_id = user.id')
        stmt.all((err, users) => {
            res.render('age', { action, users, navbar })
        })
    } else {
        res.render('age', { navbar })
    }
})


app.get('/test', (req, res) => {
    res.send('ok')

    Crawl.setCredentials(config.username, config.password)

    setTimeout(() => {
        console.log('Going to pg...')
        Crawl.getNightmare()
            .refresh()
            // .goto('https://instagram.com/----/')
            .then(() => {
                console.log('Went...')
            }).catch(console.log)
    }, 7000)
})



app.use((err, req, res, next) => {
    res.status(err.status || 500)
    res.send(err.message)
})


// Start the webserver
const httpServer = http.createServer(app)
SocketServer.init(httpServer)
httpServer.listen(config.webserverHttpPort)


process.on('uncaughtException', err => console.log(err))