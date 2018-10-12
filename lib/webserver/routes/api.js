const getFolderSize = require('get-folder-size')
const express       = require('express');
const router        = express.Router();

const Database = require('../lib/Database')
const Queue    = require('../lib/Queue')
const Robot    = require('../lib/Robot')
const Crawl    = require('../lib/Crawl')
const Util     = require('../lib/Util')
const EventEmitter = require('../lib/EventEmitter')

router.get('/', (req, res) => {
    res.send('Welcome to the API!')
})





router.get('/storageSize', (req, res) => {
    getFolderSize('storage', (err, size) => {
        if (err) {
            res.json({ error:'could not get size' })
            throw err
        } else {
            res.json({ size:size })
        }
    })
})





router.get('/user', (req, res) => {
    if (req.query.username) {
        Database.getFullUser(req.query.username)
            .then(user => res.json(user))
            .catch(console.log)
    } else if (req.query.id) {
        Database.getFullUser(req.query.id, 'user.id')
            .then(user => res.json(user))
            .catch(console.log)
    } else {
        res.json({ error:'bad query', query:req.query })
    }
})

router.get('/user/add', (req, res) => {
    let username = req.query.username
    if (username)
        Database.query.run('INSERT INTO user (username) VALUES (?)', username)
            .then(() => res.json({ success:true, username:username }))
            .catch(console.log)
    else
        res.json({ success:false, username:username })
})

router.get('/user/update', (req, res) => {
    let username = req.query.username, id = req.query.id
    if (!(username || id)) {
        res.json({ error:'bad query', query:req.query })
    } else {
        let user = {}, whatVar = 'username', whatVal = username
        if (req.query.isPrivate)        user.is_private         = req.query.isPrivate
        if (req.query.otherData)        user.other_data         = req.query.otherData
        if (req.query.stillExists)      user.still_exists       = req.query.stillExists
        if (req.query.downloadAllPosts) user.download_all_posts = req.query.downloadAllPosts
        if (req.query.newUsername)      user.username           = req.query.newUsername
        if (id) { whatVar = 'id'
                  whatVal =  id }
        if (Object.keys(user).length)
            Database.update('user', user, whatVar, whatVal)
                .then(() => res.json({ success:true, username, id, fields:user }))
                .catch(console.log)
        else
            res.json({ success:false, username, id, fields:user })
    }
})

router.get('/user/search', (req, res) => {
    let username = req.query.username
    if (username) {
        Database.query.all(`SELECT id, username FROM user WHERE username LIKE "%${username.replace(/"/g,'')}%"`)
            .then(users => res.json({ username:username, result:users }))
            .catch(console.log)
    } else {
        res.json({ error:'bad query', query:req.query })
    }
})

router.get('/user/posts2Queue', (req, res) => {
    let username = req.query.username
    if (username) {
        Database.query.all('SELECT * FROM post WHERE saved_content = 1 AND user_id = (SELECT id FROM user WHERE username = ?)', username).then(posts => {
            let items = []
            posts.forEach(post => {
                items.push({ type:'post', content:post.code })
            })
            if (items.length > 0)
                Queue.addToQueue.apply(Queue.addToQueue, items)
                    .then(() => res.json({ success:true, username, numPosts:items.length }))
                    .catch(console.log)
            else
                res.json({ success:true, username, numPosts:0 })
        })
    } else {
        res.json({ error:'bad query', query:req.query })
    }
})

router.get('/user/profilePic', (req, res) => {
    let username = req.query.username
    if (username) {
        Database.getUser(username).then(user => {
            if (user) {
                Database.query.get('SELECT filename FROM profile_pic WHERE user_id = ? ORDER BY id DESC', user.id).then(profilePic => {
                    if (profilePic)
                        res.json({ success:true, username, filename:profilePic.filename })
                    else
                        res.json({ success:true, username, filename:null })
                }).catch(console.log)
            } else {
                res.json({ error:'bad username', username })
            }
        }).catch(console.log)
    } else {
        res.json({ error:'bad query', query:req.query })
    }
})





router.get('/storySubscription/update', (req, res) => {
    let username = req.query.username, interval = req.query.interval
    if (username && interval && /^[0-9]+$/.test(interval)) {
        Database.getUser(username).then(user => {
            Database.query.run('INSERT OR REPLACE INTO story_subscription (user_id, interval, last_check) VALUES (?, ?, (SELECT last_check FROM story_subscription WHERE user_id = ?))', user.id, interval, user.id).then(() => {
                res.json({ success:true, username, interval })
            }).catch(console.log)
        }).catch(console.log)
    } else {
        res.json({ error:'bad query', query:req.query })
    }
})





router.get('/post/deleteContent', (req, res) => {
    let code = req.query.code
    if (code) {
        Robot.deletePostContent(code).then(post => {
            res.json({ success:true, post })
        }).catch(err => console.log('/post/forcedownload error:', err))
    } else {
        res.json({ error:'bad query', query:req.query })
    }
})

router.get('/post/contents', (req, res) => {
    let code = req.query.code
    if (code) {
        Database.getPostByCode(code).then(post => {
            if (!post) return res.json({ success:false })
            Database.getContentsByPost(post).then(contents => {
                res.json({ success:true, code, contents })
            }).catch(console.log)
        }).catch(console.log)
    } else {
        res.json({ error:'bad query', query:req.query })
    }
})





router.get('/usertag', (req, res) => {
    let id = req.query.id
    if (id) {
        Database.query.all('SELECT tag FROM user_tag WHERE user_id = ?', id)
            .then(tags => res.json({ id, tags }))
            .catch(console.log)
    } else {
        res.json({ error:'bad query', query:req.query })
    }
})

router.get('/usertag/update', (req, res) => {
    let tags = req.query.tags, id = req.query.id
    if (tags && id) {
        tags = tags.split(',')
        Database.updateUserTags(id, tags)
            .then(success => res.json({ success:success, id:id, tags:tags }))
            .catch(console.log)
    } else {
        res.json({ error:'bad query', query:req.query })
    }
})





router.get('/userrelation', (req, res) => {
    let id = req.query.id
    if (id) {
        Database.query.all('SELECT * FROM user_relation WHERE from_user_id = ? OR to_user_id = ? AND mutual = 1', id, id)
            .then(relations => res.json( id, relations ))
            .catch(console.log)
    } else {
        res.json({ error:'bad query', query:req.query })
    }
})

router.get('/userrelation/add', (req, res) => {
    let fromUsername = req.query.fromUsername, toUsername = req.query.toUsername, relation = req.query.relation, mutual = req.query.mutual || 0
    if (fromUsername && toUsername && relation) {
        Database.getUser(fromUsername).then(fromUser => {
            Database.getUser(toUsername).then(toUser => {
                Database.query.get('SELECT * FROM user_relation WHERE  (from_user_id = ? AND to_user_id = ?) OR (to_user_id = ? AND from_user_id = ?) AND relation = ?', fromUser.id, toUser.id, toUser.id, fromUser.id, relation).then(previous => {
                    if (previous) {
                        res.json({ error:'already exists', fromUsername, toUsername, relation, mutual })
                    } else {
                        Database.set('user_relation', ['from_user_id', 'to_user_id', 'relation', 'mutual'], [fromUser.id, toUser.id, relation, mutual]).then(() => {
                            res.json({ success:true, fromUsername, toUsername, relation, mutual })
                        }).catch(console.log)
                    }
                }).catch(console.log)
            }).catch(console.log)
        }).catch(console.log)
    } else {
        res.json({ error:'bad query', query:req.query })
    }
})





router.get('/age', (req, res) => {
    let id = req.query.id, username = req.query.username
    if (id || username) {
        let q = id ? 'SELECT * FROM age WHERE user_id = ?' : 'SELECT * FROM age WHERE user_id = (SELECT id FROM user WHERE username = ?)',
            v = id ? id : username
        Database.query.get(q, v)
            .then(age => {
                let o = { start:age.birthday_start, stop:age.birthday_stop, average:Util.average(age.birthday_start, age.birthday_stop) }
                if (id) o.id       = id
                else    o.username = username
                res.json(o)
            }).catch(console.log)
    } else {
        res.json({ error:'bad query', query:req.query })
    }
})

router.get('/age/update', (req, res) => {
    let id = req.query.id,
        start = req.query.start || null,
        stop  = req.query.stop || null,
        delet = req.query.delete
    if (id && (start || delet != undefined))
        if (start)
            Database.set('age', ['user_id', 'birthday_start', 'birthday_stop'], [id, start, stop])
                .then(() => res.json({ success:true, age:{ id, start, stop } }))
                .catch(console.log)
        else
            Database.delet('age', 'user_id', id)
                .then(() => res.json({ success:true, age:null }))
                .catch(console.log)
    else
        res.json({ error:'bad query', query:req.query })
})

router.post('/age/update', (req, res) => {
    let toUpdate = req.body.toUpdate
    if (toUpdate) {
        let values = []
        for (let userId in toUpdate) {
            let start = toUpdate[userId].start, stop = toUpdate[userId].stop
            values.push([userId, start, start !== stop ? stop : null])
        }
        console.log('Setting values:', values)
        if (values.length >= 3) {
            Database.set.apply(Database.set, ['age', ['user_id','birthday_start','birthday_stop'], ...values])
                .then(() => res.json({ success:true,  }))
                .catch(console.log)
        } else {
            res.json({ success:false, toUpdate:toUpdate })
        }
    } else {
        res.json({ error:'bad body', body:req.body })
    }
})





router.get('/queue/items', (req, res) => {
    Database.query.all('SELECT * FROM queue ORDER BY priority DESC LIMIT 1000')
        .then(items => res.json({ items:items }))
        .catch(console.log)
})

router.get('/queue/add', (req, res) => {
    let type = req.query.type, content = req.query.content, priority = req.query.priority
    if (type && content) {
        let item = { type:type, content:content }
        if (priority)
            if (priority === '0' || priority === 'false')
                item.priority = 0
            else
                item.priority = 1
        Queue.addToQueue(item)
            .then(() => res.json({ success:true }))
            .catch(console.log)
    } else {
        res.json({ error:'bad query', query:req.query })
    }
})

router.get('/queue/remove', (req, res) => {
    let id = req.query.id
    if (id) {
        Queue.removeFromQueue(id)
            .then(() => res.json({ success:true }))
            .catch(console.log)
    } else {
        res.json({ error:'bad query', query:req.query })
    }
})





router.get('/robot/tryDoNext', (req, res) => {
    Robot.tryDoNext().then(result => {
        res.json({ success:true, ran:result.ran, type:(result.item !== null ? result.item.type : null) })
    }).catch(console.log)
})

router.get('/robot/status', (req, res) => {
    res.json({ status:Robot.getStatus() })
})

router.get('/robot/paused', (req, res) => {
    res.json({ paused:Robot.getPaused() })
})

router.get('/robot/pause', (req, res) => {
    if (Robot.getPaused()) {
        res.json({ paused:true, wasPaused:true })
    } else {
        Robot.setPaused(true)
        res.json({ paused:true, wasPaused:false })
    }
})

router.get('/robot/unpause', (req, res) => {
    if (Robot.getPaused()) {
        Robot.setPaused(false)
        Robot.tryDoNext().then(result => {
            res.json({ paused:false, wasPaused:true, ran:result.ran, type:(result.item !== null ? result.item.type : null) })
        }).catch(console.log)
    } else {
        res.json({ paused:false, wasPaused:false })
    }
})

router.get('/robot/storiesPause', (req, res) => {
    if (Robot.getStoriesPaused()) {
        res.json({ storiesPaused:true, wasStoriesPaused:true })
    } else {
        Robot.setStoriesPaused(true)
        res.json({ storiesPaused:true, wasStoriesPaused:false })
    }
})

router.get('/robot/storiesUnpause', (req, res) => {
    if (Robot.getStoriesPaused()) {
        Robot.setStoriesPaused(false)
        res.json({ storiesPaused:false, wasStoriesPaused:true })
    } else {
        res.json({ storiesPaused:false, wasStoriesPaused:false })
    }
})

router.get('/robot/loggedIn', (req, res) => {
    res.json({ loggedIn:Crawl.getLoggedInTo() })
})

module.exports = router