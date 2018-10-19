const express    = require('express')
const path       = require('path')
const favicon    = require('serve-favicon')
const logger     = require('morgan')
const bodyParser = require('body-parser')
const http       = require('http')
const database   = require('database')
const fsUtils    = require('nodejs-fs-utils')
const fs         = require('fs')

const config = require('../../config')
const { index, navbar } = require('./pages.json')

const socketServer = require('./socket_server')
const app = express()

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'pug')

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))
app.use(logger('dev'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.static(path.join(__dirname, 'public')))

app.use('/storage', express.static(config.paths.storageFolder))
// app.use('/storage', (req, res, next) => res.sendFile(path.join(__dirname, 'public/images/gnome.png')))
app.use('/api', require('./routes/api'))

app.get('/', (req, res, next) => {
    let list = []
    for (let k in index) list.push({ href:k, description:index[k] })
    res.render('index', { links:list })
})

app.get('/user', (req, res, next) => {
    if (req.query.username)
        database.getUserFull(req.query.username)
            .then(user => res.render('user', { user, navbar }))
            .catch(console.log)
    else
        res.render('user', { navbar })
})

app.get('/userSearch', (req, res, next) => {
    res.render('userSearch', { navbar })
})

app.get('/users', (req, res, next) => {
    // TODO: sort and flow may be sqlinjectable
    let sort = req.query.sort, flow = req.query.flow, loginId = req.query.loginId, subscriptions = req.query.subscriptions === 'true'
    if (subscriptions) {
        if (loginId) {
            database.query.all(
                `SELECT
                    user.*,
                    user_real_name.value as real_name,
                    subscription.login_id as subscription_login_id,
                    subscription.profile as subscription_profile,
                    subscription.story as subscription_story,
                    subscription.posts as subscription_posts,
                    subscription.interval as subscription_interval
                FROM user
                LEFT JOIN subscription ON (subscription.user_id = user.id AND subscription.login_id = ?)
                LEFT JOIN user_real_name ON user_real_name.user_id = user.id
                WHERE user.id NOT IN (SELECT user_tag.user_id FROM user_tag WHERE user_tag.value = "hidden")
                GROUP BY user.id
                ORDER BY ${sort || 'id'} ${flow || 'ASC'}`, loginId).then(users => {
                    res.render('users', { users, sort, flow, navbar, doSub:true })
            }).catch(console.log)
        } else {
            res.send('bad query')
        }
    } else {
        database.query.all(
            `SELECT
                user.*,
                user_real_name.value as real_name
            FROM user
            LEFT JOIN user_real_name ON user_real_name.user_id = user.id
            WHERE user.id NOT IN (SELECT user_tag.user_id FROM user_tag WHERE user_tag.value = "hidden")
            GROUP BY user.id
            ORDER BY ${sort || 'id'} ${flow || 'ASC'}`)
                .then(users => res.render('users', { users, sort, flow, navbar }))
                .catch(console.log)
    }
})

app.get('/post', (req, res, next) => {
    database.getFullPostByCode(req.query.code)
        .then(post => {
            database.getContentsByPost(post)
                .then(contents => res.render('post', { post, contents, navbar }))
                .catch(console.log)
        })
        .catch(console.log)
})

app.get('/posts', (req, res, next) => {
    let username = req.query.username, sort = req.query.sort || 'uploaded', flow = req.query.flow || 'DESC'
    if (username)
        database.getUser(username)
            .then(user => {
                database.query.all(`SELECT * FROM post WHERE user_id = ? AND saved_content = 1 ORDER BY ${sort} ${flow}`, user.id)
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
        database.getUser(username)
            .then(user => {
                database.getAll('story', 'user_id', user.id, '*'/* , sort, flow */)
                    .then(stories => res.render('stories', { stories, user/*, sort, flow*/, navbar }))
            }).catch(console.log)
    else
        res.render('stories', { navbar })
})

app.get('/stats', (req, res, next) => {
    database.getStats().then(stats => {
        fsUtils.fsize(config.paths.storageFolder, (err, size) => {
            if (err) console.log(err)
            else {
                stats.storage_size = size
                fs.readdir(config.paths.storageFolder, (err, files) => {
                    if (err) console.log(err)
                    else {
                        stats.storage_files = files.length
                        fs.readdir(config.paths.trashcanFolder, (err, files) => {
                            if (err) console.log(err)
                            else {
                                stats.trashcan_files = files.length
                                stats.files = stats.storage_files + stats.trashcan_files
                                res.render('stats', { stats, navbar })
                            }
                        })
                    }
                })
            }
        })
    }).catch(console.log)
})

app.get('/profilePictures', (req, res, next) => {
    let username = req.query.username
    if (username) {
        database.getProfilePictures(username).then(profilePics => {
            res.render('profilePics', { profilePics, navbar })
        }).catch(console.log)
    } else {
        res.render('profilePics', { navbar })
    }
})

app.get('/contents', (req, res, next) => {
    let code = req.query.code, username = req.query.username
    if (code) {
        database.getPostByCode(code).then(post =>  {
            database.getContentsByPost(post).then(contents => {
                res.render('contents', { contents, post, navbar })
            }).catch(console.log)
        }).catch(console.log)
    } else if (username) {
        database.getUser(username).then(user => {
            database.getContentsByUser(user).then(contents => {
                res.render('contents', { contents, user, navbar })
            }).catch(console.log)
        }).catch(console.log)
    } else {
        res.render('contents', { navbar })
    }
})

// TODO: reimplement the robot
app.get('/robot', (req, res, next) => {
    database.query.all('SELECT id, username FROM login').then(logins => {
        res.render('robot', { status:false, paused:false, storiesPaused:false, navbar, logins })
    }).catch(console.log)
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
        let stmt = database.db.prepare('SELECT * FROM user WHERE id NOT IN (SELECT user_id FROM age)')
        stmt.all((err, users) => {
            res.render('age', { action, users, navbar })
        })
    } else if (action === 'update') {
        let stmt = database.db.prepare('SELECT user.*, age.* FROM user JOIN age ON age.user_id = user.id')
        stmt.all((err, users) => {
            res.render('age', { action, users, navbar })
        })
    } else {
        res.render('age', { navbar })
    }
})




app.use((err, req, res, next) => {
    res.status(err.status || 500)
    res.send(err.message)
})


// Start the webserver
const httpServer = http.createServer(app)
socketServer.init(httpServer)
httpServer.listen(config.webserverHttpPort)


process.on('uncaughtException', err => console.log(err))