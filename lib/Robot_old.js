// THE ROBOT DOES WHATEVER IS IN THE QUEUE

const Crawl = require('./Crawl_old')
const Database = require('./Database')
const Util = require('./Util')
const Queue = require('./Queue')
const EventEmitter = require('./EventEmitter')

const config = require('../config')
const u = config.user, p = config.password

let status = 'idle'
let getStatus = () => status
let setStatus = (newStatus) => {
    status = newStatus
    EventEmitter.emit('robotSetStatus', newStatus)
}

let busy = false
let getBusy = () => busy

let paused = false
let getPaused = () => paused
let setPaused = (newPaused) => {
    paused = newPaused
    EventEmitter.emit('robotSetPaused', newPaused)
}

EventEmitter.on('addedToQueue', () => {
    if (!getPaused())
        tryDoNext()
})

function tryDoNext() {
    return new Promise((resolve, reject) => {
        Queue.getFirstItem().then(item => {
            if (!item) {
                setStatus('idle')
                return resolve({ ran:false, item:null })
            }
            
            let ran = false
            if (item.type === 'profile') {
                ran = _do(doProfile, item.id, item.content)
            } else if (item.type === 'post') {
                ran = _do(doPost, item.id, item.content)
            } else if (item.type === 'downloadSaved') {
                ran = _do(doSavedPosts, item.id)
            } else if (item.type === 'saved2Queue') {
                ran = _do(doSaved2Queue, item.id)
            } else if (item.type === 'login') {
                ran = _do(doLogin, item.id, item.content.split(':')[0], item.content.split(':')[1])
            } else if (item.type === 'content2DownloadQueue'){
                ran = _do(doContent2DownloadQueue, item.id)
            } else if (item.type === 'downloadContent') {
                ran = _do(doDownloadContent, item.id, item.content)
            } else {
                console.log('ITEM IN QUEUE IS OF UNKNOWN TYPE', item)
            }
            resolve({ ran:ran, item:item })
        }).catch(console.log)
    })
}

function _do(fn, ...args) {
    if (!busy) {
        busy = true
        setStatus(fn.name)
        fn.apply(fn, args)
        return true
    } else {
        console.log('Tried to _do when busy...', fn.name)
        return false
    }
}

function _done() {
    busy = false
    if (!paused)
        tryDoNext()
}

async function doProfile(queueId, username) {
    try {
        await (Crawl.doLogin(u, p))

        if (!await (Database.isUser(username)))
            await (Database.addUser(username))

        let user = await (Database.getUser(username))

        let codes, previousPosts, dlap = (user.download_all_posts === 1)
        if (dlap) {
            codes = await (Database.query.all('SELECT code FROM post WHERE user_id = ? AND code NOT IN (SELECT code FROM saved)'))
            previousPosts = codes.map(r => r.code)
        }

        let profileData = await (Crawl.getProfile(user.username, previousPosts, dlap))

        let updObj = { still_exists: false }
        if (!profileData.error) {
            updObj = {
                post_count: profileData.postCount,
                followers_count: profileData.followersCount,
                following_count: profileData.followingCount,
                biography: profileData.biography,
                real_name: profileData.realName,
                webpage: profileData.webpage,
                is_private: profileData.isPrivate,
                still_exists: true
            }
            
            if (!await (Database.isProfilePic(profileData.profilePictureUrl))) {
                let fn = await (Util.downloadMedia(profileData.profilePictureUrl))  

                await (Database.set('profile_pic', ['user_id', 'url', 'filename'], [user.id, profileData.profilePictureUrl, fn]))
            }
        }

        await (Database.update('user', updObj, 'id', user.id))

        if (profileData.posts && profileData.posts.length > 0) {
            let rawValues = ''
            profileData.posts.forEach(code => rawValues += `("${code}", ${user.id}),`)
            rawValues = rawValues.slice(0,-1)

            await (Database.query.run(`INSERT OR IGNORE INTO post (code, user_id) VALUES ${rawValues}`))

            let items = []
            profileData.posts.forEach(code => items.push({ type:'post', content:code }))

            await (Queue.addToQueue.apply(Queue.addToQueue, items))
        }

        await (Queue.removeFromQueue(queueId))

        console.log('doProfile done')
        _done()
    } catch (e) {
        console.log('doProfile error!', e)
        _done()
    }
}

async function doPost(queueId, code) {
    try {
        var post, saveContent = true

        let whenDone = async function() {
            await (Queue.removeFromQueue(queueId))
            console.log('doPost done')
            _done()
        }

        if (await (Database.isPostByCode(code))) {
            post = await (Database.getPostByCode(code))
            if (post.saved_content) {
                saveContent = false
                console.log('The post had already been saved, updating instead')
                // await (Queue.removeFromQueue(id))
                // return whenDone('already saved')
            }
        }

        if (code.length > 25)
            await (Crawl.doLogin(u, p))
        
        let postData = await (Crawl.getPost(code, saveContent))

        console.log('Mentions:', postData.mentions)

        if (postData.error) {
            await (Queue.removeFromQueue(queueId))
            console.log('Post data error', postData.error)
            return whenDone()
        }
                            
        if (!await (Database.isUser(postData.uploader))) {
            await (Database.addUser(postData.uploader))
            await (Database.addToQueue('profile', postData.uploader))
        }

        let user = await (Database.getUser(postData.uploader))

        let updObj = {
            still_exists:true,
            uploaded:postData.uploaded,
            caption:postData.description,
            comment_count:postData.commentCount,
            like_count:postData.likeCount,
        }

        let otherData = {}

        if (postData.mentions.length > 0)
            otherData.mentions = postData.mentions
        if (post && post.other_data)
            otherData = Util.merge(JSON.parse(post.other_data), otherData)
        if (Object.keys(otherData).length > 0)
            updObj.other_data = JSON.stringify(otherData)

        if (!post) {
            await (Database.addPost(code, user, updObj))
        } else {
            await (Database.update('post', updObj, 'id', post.id))
        }

        post = await (Database.getPostByCode(code))
        
        let next = async function() {
            await (Database.update('post', { saved_content:true }, 'id', post.id))
            whenDone()
        }
        
        if (saveContent) {
            var i = 0
            postData.media.forEach(async function(media) {
                await (Database.addPostContent(post, {
                    media_url: media.media.split('?')[0],
                    preview_url: media.preview.split('?')[0],
                    is_video: media.type === 'video',
                    user_id: user.id
                }))
                if (i+++1 === postData.media.length)
                    next()
            })
        } else {
            next()
        }
    } catch (e) {
        console.log('doPost error!', e)
        if (e.details === 'ERR_CONNECTION_CLOSED') {
            console.log('Restarting nightmare...')
            await (Crawl.end())
        }
        _done()
    }
}

async function doSavedPosts(queueId, login) {
    try {
        await (Crawl.doLogin(u, p))

        if (Crawl.getIsLoggedIn()) {
            let rows = await (Database.getSaved())
            let previouslySaved = rows.map(r => r.code)

            let data = await (Crawl.getSavedPosts(previouslySaved))

            if (data.posts.length > 0) {
                await (Database.addSaved.apply(Database.addSaved, data.posts))
                console.log('Added', data.posts.length, 'new saved posts to database')
            }

            await (Queue.removeFromQueue(queueId))
            
            console.log('doSavedPosts done')
            _done()
        } else {
            console.log('Wanted to get saved posts but we are not logged in...')

            await (Queue.removeFromQueue(queueId))
            _done()
        }
    } catch (e) {
        console.log('doSavedPosts error!', e)
        _done()
    }
}

async function doSaved2Queue(queueId) {
    try {
        await (Database.query.run(`INSERT OR IGNORE INTO queue (type,content) SELECT "post",code FROM saved WHERE code NOT IN (SELECT code FROM post)`))
        await (Queue.removeFromQueue(queueId))

        console.log('doSaved2Queue done')
        _done()
    } catch (e) {
        console.log('doSaved2Queue error!', e)
        _done()
    }
}

async function doLogin(queueId, login, password) {
    try {
        await (Crawl.doLogin(login, password))
        await (Queue.removeFromQueue(queueId))

        console.log('doLogin done')
        _done()
    } catch (e) {
        console.log('doLogin error!', e)
        _done()
    }
}

async function doContent2DownloadQueue(queueId) {
    try {
        await (Database.query.run('INSERT INTO queue (type, content) SELECT "downloadContent", id FROM content WHERE LENGTH(media_url) > 0 AND stored_locally = 0'))
        await (Queue.removeFromQueue(queueId))

        console.log('doContent2DownloadQueue done')
        _done()
    } catch (e) {
        console.log('doContent2DownloadQueue error!', e)
        _done()
    }
}

async function doDownloadContent(queueId, contentId) {
    let content
    try {
        content = await (Database.query.get('SELECT * FROM content WHERE id = ?', contentId))

        if (content.stored_locally === 1) {
            console.log('Content with id', contentId, 'already downloaded')
        } else {
            let previewName, fileName = await (Util.downloadMedia(content.media_url))
            console.log('Downloaded file', fileName)
    
            if (content.is_video === 1) {
                previewName = await (Util.downloadMedia(content.preview_url))
                console.log('Downloaded preview for video', previewName)
            }
            
            let pathToHash = 'storage/'
            
            if (content.is_video === 1) pathToHash += previewName
            else                        pathToHash += fileName
            
            let hash = await (Util.hashFromFile(pathToHash))
            console.log('Hashed image from', pathToHash, 'to', hash)
    
            await (Database.update('content', {
                stored_locally:true,
                preview_filename:previewName,
                media_filename:fileName,
                image_hash:hash
            }, 'id', content.id))
        }

        await (Queue.removeFromQueue(queueId))

        console.log('doDownloadContent done')
        _done()
    } catch (e) {
        console.log('doDownloadContent error!', e)
        console.log('content:', content)
        _done()
    }
}



// let tasks = []
// let intervalId = setInterval(() => {
//     if (tasks.length === 0)
//         addTask(nextInQueueTask())
// }, 60000)

// let getTasks = () => tasks
// let getRunning = () => intervalId !== null

// { run:<function>, name:<string> }
// function addTask(task) {
//     console.log('Adding task', task)
//     tasks.push(task)
//     if (tasks.length === 1)
//         doNextTask()
// }

// function doNextTask() {
//     console.log('Attempting to run next task')
//     if (tasks.length > 0) {
//         let task = tasks.splice(0, 1)[0]
//         status = `running "${task.name || 'unnamed'}"`
//         task.run()
//             .then(message => {
//                 console.log('Task finished, returned', message)
//                 doNextTask()
//             })
//             .catch(err => console.log('Caught an error executing a task', err))
//     } else {
//         status = 'idle'
//     }
// }

// let isBusy       = ()                => Crawl.busy
// let isLoggedIn   = ()                => Crawl.isLoggedIn !== null
// let isLoggedInTo = (login)           => Crawl.isLoggedIn === login

// let doLogin      = (login, password) => Crawl.doLogin(login, password)


// function nextInQueueTask() {
//     return {
//         run: () => {
//             return new Promise((resolve, reject) => {
//                 Queue.getFirstItem().then(async function(row) {
//                     let whenDone = msg => {
//                         if (tasks.length <= 0)
//                             addTask(nextInQueueTask())
//                         resolve(msg)
//                     }

//                     if (!row) return resolve('empty queue') // WE DO NOT ADD A nextInQueueTask HERE!
//                     console.log('Next in queue is:', row)
            
//                     try {
//                         if (row.type === 'post') {
            
//                             var post
            
//                             if (await (Database.isPostByCode(row.content))) {
//                                 post = await (Database.getPostByCode(row.content))
//                                 if (post.saved_content) {
//                                     console.log('The post had already been saved')
//                                     await (Queue.removeFromQueue(row.id))
//                                     return whenDone('already saved')
//                                 }
//                             }
        
//                             await (Crawl.doLogin(u, p))
                            
//                             let postData = await (Crawl.getPost(row.content))
        
//                             if (postData.error) {
//                                 await (Queue.removeFromQueue(row.id))
//                                 return whenDone(postData.error)
//                             }
                                                
//                             if (!await (Database.isUser(postData.uploader))) {
//                                 await (Database.addUser(postData.uploader))
//                                 await (Database.addToQueue('profile', postData.uploader))
//                             }
            
//                             let user = await (Database.getUser(postData.uploader))
            
//                             if (!post)
//                                 await (Database.addPost(row.content, user, { still_exists: true, uploaded: postData.uploaded, caption: postData.description }))
                            
//                             post = await (Database.getPostByCode(row.content))
                            
//                             let next = async function() {
//                                 await (Database.update('post', {'saved_content': true}, 'id', post.id))
//                                 await (Queue.removeFromQueue(row.id))
//                                 whenDone('saved')
//                             }
                            
//                             var i = 0
//                             postData.media.forEach(async function(media) {
//                                 await (Database.addPostContent(post, {
//                                     media_url: media.media,
//                                     preview_url: media.preview,
//                                     is_video: media.type === 'video'
//                                 }))
//                                 if (i+++1 === postData.media.length)
//                                     next()
//                             })
//                         }
        
//                         else if (row.type === 'profile') {
                
//                             let username = row.content
        
//                             if (!await (Database.isUser(username)))
//                                 await (Database.addUser(username))
        
//                             let user = await (Database.getUser(username))

//                             console.log('Dealing with user', user)
        
//                             let codes = await (Database.query.all('SELECT code FROM post WHERE user_id = ?'))

//                             let previousPosts = codes.map(r => r.code)
    
//                             let profileData = await (Crawl.getProfile(user.username, previousPosts, user.download_all_posts === 'true'))
    
//                             let updObj = { still_exists: false }
//                             if (!profileData.error) {
//                                 let fn = await (Util.downloadMedia(profileData.profilePictureUrl))  
//                                 updObj = {
//                                     post_count: profileData.postCount,
//                                     followers_count: profileData.followersCount,
//                                     following_count: profileData.followingCount,
//                                     biography: profileData.biography,
//                                     real_name: profileData.realName,
//                                     webpage: profileData.webpage,
//                                     is_private: profileData.isPrivate,
//                                     profile_pic_url: profileData.profilePictureUrl,
//                                     profile_pic_filename: fn,
//                                     still_exists: true
//                                 }
//                             }

//                             await (Database.update('user', updObj, 'id', user.id))

//                             if (profileData.posts && profileData.posts.length > 0) {
//                                 let rawValues = ''
//                                 profileData.posts.forEach(code => rawValues += `("${code}", ${user.id}),`)
//                                 rawValues = rawValues.slice(0,-1)

//                                 await (Database.query.run(`INSERT OR IGNORE INTO post (code, user_id) VALUES ${rawValues}`))

//                                 rawValues = ''
//                                 profileData.posts.forEach(code => rawValues += `("post", "${code}"),`)
//                                 rawValues = rawValues.slice(0,-1)

//                                 await (Database.query.run(`INSERT OR IGNORE INTO queue (type, content) VALUES ${rawValues}`))
//                             }

//                             await (Queue.removeFromQueue(row.id))
//                             whenDone('saved')
//                         }
//                     } catch (e) {
//                         console.log('Encountered error', e)
//                         whenDone(e)
//                     }
//                 }).catch(e => {
//                     throw e
//                 })
//             })
//         },
        // run: () => {
        //     console.log('Running next in queue task')
        //     return new Promise((resolve, reject) => {
        //         let whenDone = () => {
        //             console.log('ONE QUEUE DONE, NEXT!')
        //             if (tasks.length === 0)
        //                 addTask(nextInQueueTask())
        //             resolve()
        //         }
        //         Database.query.get('SELECT * FROM queue').then(row => {
        //             if (!row) return resolve() //// DO SOMETHING HERE THAT MAKES ROBOT TRY AGAIN IN LIKE 1 MINUTE OR SOMETHING IDK

        //             let next
        //             if (row.type === 'post') {
        //                 let post

        //                 next = () => {
        //                     doLogin(u, p).then(() => {
        //                         Crawl.getPost(row.content).then(postData => {
        //                             if (postData.error) {
        //                                 Queue.removeFromQueue(row.id).then(() => {
        //                                     console.log('Error from crawl on post', row.content, ':', postData.error)
        //                                     whenDone()
        //                                 }).catch(reject)
        //                             } else {
        //                                 next = () => {
        //                                     Database.getUser(postData.uploader).then(user => {
        //                                         next = () => {
        //                                             let n = 0
        //                                             next = () => {
        //                                                 if (n >= postData.media.length) {
        //                                                     Database.update('post', { saved_content:true }, 'id', post.id).then(() => {
        //                                                         Queue.removeFromQueue(row.id)
        //                                                             .then(whenDone)
        //                                                             .catch(reject)
        //                                                     }).catch(reject)
        //                                                 } else {
        //                                                     let media = postData.media[n++]
        //                                                     Database.addPostContent(post, {
        //                                                         media_url: media.media,
        //                                                         preview_url: media.preview,
        //                                                         is_video: media.type === 'video'
        //                                                     })
        //                                                         .then(next)
        //                                                         .catch(reject)
        //                                                 }
        //                                             }


        //                                         }

        //                                         if (!post) {
        //                                             Database.addPost(row.content, user, { 
        //                                                 still_exists: true, 
        //                                                 uploaded: postData.uploaded, 
        //                                                 caption: postData.description 
        //                                             }).then(() => {
        //                                                     Database.getPostByCode(row.content).then(p => {
        //                                                         post = p
        //                                                         next()
        //                                                     }).catch(reject)
        //                                                 }).catch(reject)
        //                                         } else {
        //                                             next()
        //                                         }
        //                                     }).catch(reject)
        //                                 }

        //                                 Database.isUser(postData.uploader).then(bool => {
        //                                     if (!bool) {
        //                                         Database.addUser(postData.uploader).then(() => {
        //                                             Database.addToQueue('profile', postData.uploader)
        //                                                 .then(next)
        //                                                 .catch(reject)
        //                                         }).catch(reject)
        //                                     } else {
        //                                         next()
        //                                     }
        //                                 }).catch(reject)
        //                             }
        //                         }).catch(reject)
        //                     }).catch(reject)
        //                 }

        //                 Database.isPostByCode(row.content).then(bool => {
        //                     if (bool) {
        //                         Database.getPostByCode(row.content).then(p => {
        //                             post = p
        //                             if (post.saved_content) {
        //                                 console.log('The post has already been saved')
        //                                 Queue.removeFromQueue(row.id)
        //                                     .then(whenDone)
        //                                     .catch(reject)
        //                             }
        //                         })
        //                     } else {
        //                         next()
        //                     }
        //                 })
        //             }
        //         }).catch(reject)
        //     })
        // },
//         name: 'nextInQueueTask'
//     }
// }

// function updateSavedPostsTask(login, password) {
//     return {
//         run: () => {
//             return new Promise((resolve, reject) => {
//                 doLogin(login, password).then(() => {
//                     Database.getSaved().then(rows => {
//                         let previouslySaved = rows.map(r => r.code)
//                         Crawl.getSavedPosts(login, password, previouslySaved).then(data => {
//                             if (data.posts.length > 0) {
//                                 Database.addSaved.apply(Database.addSaved, data.posts).then(success => {
//                                     resolve(success)
//                                 }).catch(reject)
//                             } else {
//                                 resolve('no new')
//                             }
//                         }).catch(reject)
//                     }).catch(reject)
//                 }).catch(reject)
//             })
//         },
//         name: 'updateSavedPostsTask'
//     }
// }

// function downloadSavedPostsTask() {
//     return {
//         run: () => {
//             return new Promise((resolve, reject) => {
//                 let stmt = Database.db.prepare(`INSERT OR IGNORE INTO queue (type,content) SELECT "post",code FROM saved WHERE code NOT IN (SELECT code FROM post)`)
//                 stmt.run(err => {
//                     if (err) reject(err)
//                     else     resolve('moved successfully')
//                 })
//             })
//         },
//         name: 'downloadSavedPostsTask'
//     }
// }

/*
does queue in background, if task comes in we pause queue and go for task if neccesary

tasks can be:
  add user (will fetch user's profile <NOT POSTS> and add to db)
  full dl user (fetches user's profile <WITH POSTS> and add to db)
  download saved posts (fetch user's saved posts and add to db, need password???)
*/

module.exports = {
    // isBusy,
    // isLoggedIn,
    // isLoggedInTo,

    // addTask,
    // doLogin,
    getStatus,
    setStatus,
    getBusy,
    getPaused,
    setPaused,
    // getTasks,
    // getRunning,

    // updateSavedPostsTask,
    // downloadSavedPostsTask,
    tryDoNext,
}