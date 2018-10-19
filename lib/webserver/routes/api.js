const express  = require('express');
const router   = express.Router();
const fsUtils = require('nodejs-fs-utils')

const database     = require('database')
const subscription = require('../../robot/subscription')
const queue        = require('../../robot/queue')
const robot        = require('../../robot/robot')
const utils        = require('utils')
const config       = require('../../../config')



router.get('/', (req, res) => {
    res.send('Welcome to the API!')
})




router.get('/user', (req, res) => {
    if (req.query.username) {
        database.getUserFull(req.query.username)
            .then(user => res.json(user))
            .catch(console.log)
    } else if (req.query.id) {
        database.getUserFull(req.query.id, 'user.id')
            .then(user => res.json(user))
            .catch(console.log)
    } else {
        res.json({ error:'bad query', query:req.query })
    }
})

router.get('/user/add', (req, res) => {
    let username = req.query.username
    if (username)
        database.query.run('INSERT INTO user (username) VALUES (?)', username)
            .then(() => res.json({ success:true, username }))
            .catch(console.log)
    else
        res.json({ success:false, username })
})

router.get('/user/update', (req, res) => {
    let username = req.query.username, id = req.query.id
    if (!(username || id)) {
        res.json({ error:'bad query', query:req.query })
    } else {
        let user = {}, whatVar = 'username', whatVal = username
        if (req.query.isPrivate)        user.is_private         = req.query.isPrivate
        if (req.query.stillExists)      user.still_exists       = req.query.stillExists
        if (req.query.newUsername)      user.username           = req.query.newUsername
        if (id) { whatVar = 'id'
                  whatVal =  id }
        if (Object.keys(user).length)
            database.update('user', user, whatVar, whatVal)
                .then(() => res.json({ success:true, username, id, fields:user }))
                .catch(console.log)
        else
            res.json({ success:false, username, id, fields:user })
    }
})

router.get('/user/search', (req, res) => {
    let username = req.query.username
    if (username) {
        database.query.all(`SELECT id, username FROM user WHERE username LIKE "%${username.replace(/"/g,'')}%"`)
            .then(users => res.json({ username:username, result:users }))
            .catch(console.log)
    } else {
        res.json({ error:'bad query', query:req.query })
    }
})

router.get('/user/posts2Queue', (req, res) => {
    let username = req.query.username, login_id = req.query.loginId
    if (username && !isNaN(parseInt(login_id))) {
        database.query.all('SELECT * FROM post WHERE saved_content = 1 AND user_id = (SELECT id FROM user WHERE username = ?)', username).then(posts => {
            let items = []
            posts.forEach(post => {
                items.push({ type:'post', login_id, content:post.code })
            })
            if (items.length > 0)
                queue.addToQueue.apply(queue.addToQueue, items)
                    .then(() => res.json({ success:true, username, login_id, numPosts:items.length }))
                    .catch(console.log)
            else
                res.json({ success:true, username, login_id, numPosts:0 })
        })
    } else {
        res.json({ error:'bad query', query:req.query })
    }
})

router.get('/user/profilePic', (req, res) => {
    let username = req.query.username
    if (username) {
        database.getUser(username).then(user => {
            if (user) {
                database.query.get('SELECT filename FROM user_profile_picture WHERE user_id = ? ORDER BY id DESC', user.id).then(profilePic => {
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



router.get('/user/subscription', (req, res) => {
    let username = req.query.username, userId = req.query.userId, loginId = req.query.loginId
    if (username) {
    } else if (userId) {
        database.query.get('SELECT * FROM subscription WHERE login_id = ? AND user_id = ? LIMIT 1', loginId, userId).then(subscription => {
            res.json({ success:true, username, userId, subscription })
        }).catch(console.log)
    } else {
        res.json({ success:false, error:'bad query', query:req.query })
    }
})

router.get('/user/subscription/update', (req, res) => {
    let username = req.query.username,
        userId = req.query.userId,
        loginId = req.query.loginId,
        profile = req.query.profile === 'true',
        story = req.query.story === 'true',
        posts = req.query.posts === 'true',
        interval = req.query.interval
    if (username)  {
    } else if (userId) {
        if (!profile && !story && !posts && !interval) {
            subscription.unsubscribe(loginId, userId).then(() => {
                res.json({ success:true, userId, loginId, userId })
            }).catch(console.log)
        } else {
            subscription.subscribe(loginId, userId, { profile, story, posts, interval }).then(() => {
                res.json({ success:true, userId, loginId, userId })
            }).catch(console.log)
        }
    } else {
        res.json({ success:false, error:'bad query', query:req.query })
    }
})





// TODO: add function for deleting content from post (and moving file(s) to trashcan)

// router.get('/post/deleteContent', (req, res) => {
//     let code = req.query.code
//     if (code) {
//         Robot.deletePostContent(code).then(post => {
//             res.json({ success:true, post })
//         }).catch(err => console.log('/post/forcedownload error:', err))
//     } else {
//         res.json({ error:'bad query', query:req.query })
//     }
// })

router.get('/post/contents', (req, res) => {
    let code = req.query.code
    if (code) {
        database.getPostByCode(code).then(post => {
            if (!post) return res.json({ success:false })
            database.getContentsByPost(post).then(contents => {
                res.json({ success:true, code, contents })
            }).catch(console.log)
        }).catch(console.log)
    } else {
        res.json({ error:'bad query', query:req.query })
    }
})





// router.get('/usertag', (req, res) => {
//     let id = req.query.id
//     if (id) {
//         database.query.all('SELECT value FROM user_tag WHERE user_id = ?', id)
//             .then(tags => res.json({ id, tags }))
//             .catch(console.log)
//     } else {
//         res.json({ error:'bad query', query:req.query })
//     }
// })

// router.get('/usertag/update', (req, res) => {
//     let tags = req.query.tags, id = req.query.id
//     if (tags && id) {
//         tags = tags.split(',')
//         database.updateUserTags(id, tags)
//             .then(success => res.json({ success:success, id, tags }))
//             .catch(console.log)
//     } else {
//         res.json({ error:'bad query', query:req.query })
//     }
// })




router.get('/userother/update')




// TODO: redo relation structure

// router.get('/userrelation', (req, res) => {
//     let id = req.query.id
//     if (id) {
//         Database.query.all('SELECT * FROM user_relation WHERE from_user_id = ? OR to_user_id = ? AND mutual = 1', id, id)
//             .then(relations => res.json( id, relations ))
//             .catch(console.log)
//     } else {
//         res.json({ error:'bad query', query:req.query })
//     }
// })

// router.get('/userrelation/add', (req, res) => {
//     let fromUsername = req.query.fromUsername, toUsername = req.query.toUsername, relation = req.query.relation, mutual = req.query.mutual || 0
//     if (fromUsername && toUsername && relation) {
//         Database.getUser(fromUsername).then(fromUser => {
//             Database.getUser(toUsername).then(toUser => {
//                 Database.query.get('SELECT * FROM user_relation WHERE  (from_user_id = ? AND to_user_id = ?) OR (to_user_id = ? AND from_user_id = ?) AND relation = ?', fromUser.id, toUser.id, toUser.id, fromUser.id, relation).then(previous => {
//                     if (previous) {
//                         res.json({ error:'already exists', fromUsername, toUsername, relation, mutual })
//                     } else {
//                         Database.set('user_relation', ['from_user_id', 'to_user_id', 'relation', 'mutual'], [fromUser.id, toUser.id, relation, mutual]).then(() => {
//                             res.json({ success:true, fromUsername, toUsername, relation, mutual })
//                         }).catch(console.log)
//                     }
//                 }).catch(console.log)
//             }).catch(console.log)
//         }).catch(console.log)
//     } else {
//         res.json({ error:'bad query', query:req.query })
//     }
// })





router.get('/age', (req, res) => {
    let id = req.query.id, username = req.query.username
    if (id || username) {
        let q = id ? 'SELECT * FROM user_age WHERE user_id = ?' : 'SELECT * FROM user_age WHERE user_id = (SELECT id FROM user WHERE username = ?)',
            v = id ? id : username
        database.query.get(q, v)
            .then(age => {
                let o = { start:age.birthday_start, stop:age.birthday_stop, average:utils.average(age.birthday_start, age.birthday_stop) }
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
            database.set('user_age', ['user_id', 'birthday_start', 'birthday_stop'], [id, start, stop])
                .then(() => res.json({ success:true, age:{ id, start, stop } }))
                .catch(console.log)
        else
            database.delet('user_age', 'user_id', id)
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
            database.set.apply(database.set, ['user_age', ['user_id','birthday_start','birthday_stop'], ...values])
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
    database.query.all('SELECT * FROM queue ORDER BY priority DESC LIMIT 1000')
        .then(items => res.json({ items:items }))
        .catch(console.log)
})

router.get('/queue/add', (req, res) => {
    let type = req.query.type, loginId = req.query.loginId, content = req.query.content, priority = req.query.priority
    if (type) {
        let item = { type }
        if (content)
            item.content = content
        if (loginId)
            item.login_id = loginId
        if (priority)
            if (priority === '0' || priority === 'false')
                item.priority = 0
            else
                item.priority = 1
        queue.addToQueue(item)
            .then(() => res.json({ success:true }))
            .catch(console.log)
    } else {
        res.json({ error:'bad query', query:req.query })
    }
})

router.get('/queue/remove', (req, res) => {
    let id = req.query.id
    if (id) {
        queue.removeFromQueue(id)
            .then(() => res.json({ success:true }))
            .catch(console.log)
    } else {
        res.json({ error:'bad query', query:req.query })
    }
})




router.get('/robot/executeNext', (req, res) => {
    robot.executeNext().then(result => {
        res.json({ success:true, ran:result.ran, type:(result.item !== null ? result.item.type : null) })
    }).catch(console.log)
})

// TODO: robot status
router.get('/robot/status', (req, res) => {
    res.json({ status:false })
})

// TODO: robot paused
// router.get('/robot/paused', (req, res) => {
//     res.json({ paused:Robot.getPaused() })
// })

// router.get('/robot/pause', (req, res) => {
//     if (Robot.getPaused()) {
//         res.json({ paused:true, wasPaused:true })
//     } else {
//         Robot.setPaused(true)
//         res.json({ paused:true, wasPaused:false })
//     }
// })

// router.get('/robot/unpause', (req, res) => {
//     if (Robot.getPaused()) {
//         Robot.setPaused(false)
//         Robot.tryDoNext().then(result => {
//             res.json({ paused:false, wasPaused:true, ran:result.ran, type:(result.item !== null ? result.item.type : null) })
//         }).catch(console.log)
//     } else {
//         res.json({ paused:false, wasPaused:false })
//     }
// })

// router.get('/robot/storiesPause', (req, res) => {
//     if (Robot.getStoriesPaused()) {
//         res.json({ storiesPaused:true, wasStoriesPaused:true })
//     } else {
//         Robot.setStoriesPaused(true)
//         res.json({ storiesPaused:true, wasStoriesPaused:false })
//     }
// })

// router.get('/robot/storiesUnpause', (req, res) => {
//     if (Robot.getStoriesPaused()) {
//         Robot.setStoriesPaused(false)
//         res.json({ storiesPaused:false, wasStoriesPaused:true })
//     } else {
//         res.json({ storiesPaused:false, wasStoriesPaused:false })
//     }
// })

router.get('/login/list', (req, res) => {
    database.query.all('SELECT id, username, ds_user_id IS NOT NULL AND sessionid IS NOT NULL as is_logged_in FROM login').then(logins => {
        res.json({ logins:logins })
    }).catch(console.log)
})



router.get('/size', (req, res) => {
    fsUtils.fsize(config.paths.storageFolder, (err, size) => {
        if (err) console.log(err)
        else res.json({ success:true, size })
    })
})



router.get('/subscription/user', (req, res) => {
    let userId = req.query.userId
    if (userId) {
        database.query.all('SELECT * FROM subscription WHERE user_id = ?', userId).then(subscriptions => {
            res.json({ success:true, subscriptions })
        }).catch(console.log)
    } else {
        res.json({ success:false, error:'bad query', query:req.query })
    }
})



module.exports = router