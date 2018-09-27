// THE ROBOT DOES WHATEVER IS IN THE QUEUE

const Crawl = require('./Crawl')
const Database = require('./Database')
const Util = require('./Util')
const Queue = require('./Queue')
const EventEmitter = require('./EventEmitter')

const config = require('../config')
const u = config.username, p = config.password

console.log('Using login', u, p)

let status = 'idle'
const getStatus = () => status
const setStatus = (newStatus) => {
    status = newStatus
    EventEmitter.emit('robotSetStatus', newStatus)
}

let busy = false
const getBusy = () => busy

let paused = false
const getPaused = () => paused
const setPaused = (newPaused) => {
    paused = newPaused
    EventEmitter.emit('robotSetPaused', newPaused)
}

let storiesPaused = false
const getStoriesPaused = () => storiesPaused
const setStoriesPaused = (newPaused) => {
    storiesPaused = newPaused
    EventEmitter.emit('robotSetStoriesPaused', newPaused)
    clearInterval(storySubIntervalId)
    if (newPaused) {
        storySubIntervalId = setInterval(checkStorySubscriptions, 60*1000)
        checkStorySubscriptions()
    }
}

var storyWaiting = []
function checkStorySubscriptions() {
    Database.query.all('SELECT (SELECT username FROM user WHERE id = story_subscription.user_id) as username FROM story_subscription WHERE story_subscription.interval + story_subscription.last_check < ?', Date.now()).then(subs => {
        let args = subs.map(sub => {
            storyWaiting.push(sub.username)
            return { type:'stories', content:sub.username, priority:1 }
        })
        if (args.length > 0) {
            Queue.addToQueue.apply(Queue.addToQueue, args).then(() => {
                console.log('Story subscriptions running.')
            }).catch(console.log)
        }
    }).catch(console.log)
}
var storySubIntervalId = setInterval(checkStorySubscriptions, 60*1000)
checkStorySubscriptions()

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
                ran = _do(doProfileInfo, item.id, item.content)
            } else if (item.type === 'profilePosts') {
                ran = _do(doProfilePosts, item.id, item.content)
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
            } else if (item.type === 'forceDownloadContent') {
                ran = _do(doForceDownloadContent, item.id, item.content)
            } else if (item.type === 'stories') {
                ran = _do(doStories, item.id, item.content)
            } else {
                console.log('ITEM IN QUEUE IS OF UNKNOWN TYPE', item)
                Queue.removeFromQueue(item.id)
            }
            resolve({ ran, item })
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

async function doProfileInfo(queueId, username) {
    let user
    try {
        await (Crawl.setCredentials(u, p))

        if (!await (Database.isUser(username)))
            await (Database.addUser(username))

        user = await (Database.getUser(username))

        let profileInfo = await (Crawl.getProfileInfo(user.username))

        let updObj = {
            username: profileInfo.username,
            instagram_id: profileInfo.instagramId,
            biography: profileInfo.biography,
            webpage: profileInfo.webpage,
            post_count: profileInfo.postCount,
            followers_count: profileInfo.followersCount,
            following_count: profileInfo.followingCount,
            real_name: profileInfo.realName,
            is_private: profileInfo.isPrivate,
            still_exists: 1
        }

        if (!await (Database.isProfilePic(profileInfo.profilePictureUrl))) {
            let fn = await (Util.downloadMedia(profileInfo.profilePictureUrl))
            await (Database.set('profile_pic', ['user_id', 'url', 'filename'], [user.id, profileInfo.profilePictureUrl, fn]))
        } else
            console.log('Profile pic already exists', username)

        await (Database.update('user', updObj, 'id', user.id))

        if (user.download_all_posts === 1)
            await (Queue.addToQueue({ type:'profilePosts', content:username }))
        
        await (Queue.removeFromQueue(queueId))

        console.log('doProfileInfo done')
        _done()
    } catch (e) {
        if (e.type === 'invalid-json') {
            if (user && user.id)
                await (Database.update('user', { still_exists:0 }, 'id', user.id))
            else
                console.log('User doesnt seem to exist...', user)
            await (Queue.removeFromQueue(queueId))
        }
        console.log('doProfileInfo error!', e)
        _done()
    }
}

async function doProfilePosts(queueId, username) {
    try {
        await (Crawl.setCredentials(u, p))

        if (!await (Database.isUser(username)))
            await (Database.addUser(username))

        let user = await (Database.getUser(username))

        let codes = await (Database.query.all('SELECT code FROM post WHERE user_id = ? AND code NOT IN (SELECT code FROM saved)', user.id))
        let previousPosts = codes.map(r => r.code)

        let profilePosts = await (Crawl.getProfilePosts(user.username, previousPosts))

        if (profilePosts.posts && profilePosts.posts.length > 0) {
            let rawValues = ''
            profilePosts.posts.forEach(code => rawValues += `("${code}", ${user.id}),`)
            rawValues = rawValues.slice(0,-1)

            await (Database.query.run(`INSERT OR IGNORE INTO post (code, user_id) VALUES ${rawValues}`))

            let items = []
            profilePosts.posts.forEach(code => items.push({ type:'post', content:code }))

            await (Queue.addToQueue.apply(Queue.addToQueue, items))
        }

        await (Queue.removeFromQueue(queueId))

        console.log('doProfilePosts done')
        _done()
    } catch (e) {
        console.log('doProfilePosts error!', e)
        _done()
    }
}

async function doPost(queueId, code) {
    var post, saveContent = true
    try {

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

        await (Crawl.setCredentials(u, p))

        let postInfo = await (Crawl.getPostInfo(code))

        if (!await (Database.isUser(postInfo.uploader))) {
            await (Database.addUser(postInfo.uploader))
            await (Database.addToQueue('profile', postInfo.uploader))
        }

        let user = await (Database.getUser(postInfo.uploader))

        let updObj = {
            still_exists:1,
            uploaded:postInfo.uploaded,
            like_count:postInfo.likeCount,
            comment_count:postInfo.commentCount,
            caption:postInfo.description
        }

        let otherData = {}

        if (postInfo.mentions.length > 0)
            otherData.mentions = postInfo.mentions

        if (post && post.other_data)
            otherData = Util.merge(JSON.parse(post.other_data), otherData)

        if (Object.keys(otherData).length > 0)
            updObj.other_data = JSON.stringify(otherData)

        if (!post) await (Database.addPost(code, user, updObj))
        else       await (Database.update('post', updObj, 'id', post.id))

        post = await (Database.getPostByCode(code))
        
        let next = async function() {
            await (Database.update('post', { saved_content:true }, 'id', post.id))
            whenDone()
        }

        if (saveContent) {
            var i = 0
            postInfo.media.forEach(async function(content) {
                await (Database.addPostContent(post, {
                    media_url:   content.media,
                    preview_url: content.preview,
                    is_video:    content.isVideo,
                    user_id:     user.id,
                    view_count:  content.viewCount
                }))
                if (i+++1 === postInfo.media.length)
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
        } else if (e.type === 'invalid-json') {
            try {
                if (post && post.id)
                    await (Database.update('post', { still_exists:0 }, 'id', post.id))
                else
                    console.log('Post doesnt seem to exist...', code)
                await (Queue.removeFromQueue(queueId))
            } catch (ee) {
                console.log('doPost error²!!', ee)
            }
        }
        _done()
    }
}

async function doSavedPosts(queueId, login) {
    try {
        await (Crawl.setCredentials(u, p))

        if (Crawl.isLoggedIn()) {
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
        await (Crawl.setCredentials(login, password))
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
        await (Database.query.run('INSERT OR IGNORE INTO queue (type, content) SELECT "downloadContent", id FROM content WHERE LENGTH(media_url) > 0 AND stored_locally = 0'))
        await (Queue.removeFromQueue(queueId))

        console.log('doContent2DownloadQueue done')
        _done()
    } catch (e) {
        console.log('doContent2DownloadQueue error!', e)
        _done()
    }
}

async function doForceDownloadContent(queueId, contentId) {
    let content
    try {
        content = await (Database.get('content', 'id', contentId))

        if (content) {
            content.stored_locally = 0
            await (Database.update('content', content, 'id', contentId))
        }

        await (Database.update('queue', { type:'downloadContent', priority:1 }, 'id', queueId))

        console.log('doForceDownloadContent done')
        _done()
    } catch (e) {
        console.log('doForceDownloadContent error!', e)
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
        _done()
    }
}

async function doStories(queueId, username) {
    try {
        let doDone = () => {

        }

        await (Crawl.setCredentials(u, p))

        let rawStories = await (Crawl.getStories(username))

        let stories = []
        
        let indx = 0
        let next = async function() {
            let story = rawStories[indx]

            if (story) {
                let previewFn, mediaFn
                if (story.isVideo) {
                    previewFn = await (Util.downloadMedia(story.previewUrl))
                }
                mediaFn = await (Util.downloadMedia(story.mediaUrl))
    
                stories.push([
                    story.userId,
                    story.uploaded,
                    story.isVideo,
                    story.previewUrl || null,
                    story.mediaUrl,
                    previewFn || null,
                    mediaFn
                ])
            }

            if (indx+++1 >= rawStories.length) {
                if (stories.length > 0) {
                    await (Database.set.apply(Database.set, ['story', ['user_id', 'uploaded', 'is_video', 'preview_url', 'media_url', 'preview_filename', 'media_filename'], ...stories]))
                    console.log('Saved', stories.length, 'stories from user', username)
                } else
                    console.log('No stories from user', username)
        
                await (Queue.removeFromQueue(queueId))

                if (storyWaiting.indexOf(username) > -1) {
                    console.log('Story subscription run!')
                    let user = await (Database.getUser(username))
                    await (Database.query.run('UPDATE OR IGNORE story_subscription SET last_check = ? WHERE user_id = ?', Date.now(), user.id))
                    storyWaiting.splice(storyWaiting.indexOf(username), 1)
                }
        
                console.log('doStories done')
                _done()
            } else
                next()
        }

        next()
    } catch (e) {
        if (e.type === 'invalid-json') {
            console.log('User', username, 'doesnt exist.')
            try {
                if (storyWaiting.indexOf(username) > -1) {
                    console.log('Story subscription run!')
                    let user = await (Database.getUser(username))
                    await (Database.query.run('DELETE FROM story_subscription WHERE user_id = ?', user.id))
                    storyWaiting.splice(storyWaiting.indexOf(username), 1)
                }

                await (Queue.removeFromQueue(queueId))
            } catch (ee) {
                console.log('doStories error²!!', ee)
            }
            console.log('doStories done')
            _done()
        } else {
            console.log('doStories error!', e)
            _done()
        }
    }
}

async function doDeleteContent(queueId, contentId) {
    try {
    } catch (e) {
        console.log('doDeleteContent error!', e)
        _done()
    }
}


function deletePostContent(code) {
    return new Promise((resolve, reject) => {
        Database.getPostByCode(code).then(post => {
            if (!post) return reject('bad code')
            Database.getContentsByPost(post).then(contents => {
                let indx = 0
                let next = () => {
                    let content = contents[indx]

                    if (content) {
                        let next1 = () => {
                            let next2 = () => {
                                Database.delet('content', 'id', content.id).then(() => {
                                    next(indx++)
                                }).catch(reject)
                            }
                            Util.moveToTrash(content.preview_filename).then(next2).catch(next2)
                        }
                        Util.moveToTrash(content.media_filename).then(next1).catch(next1)
                    } else {
                        post.saved_content = 0
                        Database.update('post', post, 'id', post.id).then(() => {
                            console.log('Removed contents for post', code)
                            resolve(post)
                        }).catch(reject)
                    }
                }

                next()
            })
        }).catch(reject)
    })
}


module.exports = {
    getStatus,
    setStatus,
    getBusy,
    getPaused,
    setPaused,
    getStoriesPaused,
    setStoriesPaused,
    tryDoNext,

    deletePostContent,
}