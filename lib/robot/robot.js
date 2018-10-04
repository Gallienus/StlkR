const path = require('path')

const eventer = require('eventer')
const instagram = require('instagram')
const database = require('database')
const utils = require('utils')

const queue = require('./queue')
const config = require('../../config')

let numExecuting = 0
let tasksExecuting = {}
let paused = false

function executeNext() {
    return new Promise(async (resolve, reject) => {
        if (tasksExecuting.length >= config.maxConcurrentTasks) {
            resolve({ ran:false, item:null, busy:true })
        } else {
            queue.getNthItem(numExecuting).then(item => {
                if (!item)
                    return resolve({ ran:false, item:null, busy:false })
    
                let ran = false
                switch (item.type) {
                    case 'login':
                        ran = executeTask(taskLogin, item.id, item.login_id)
                        break
                    case 'profile':
                        ran = executeTask(taskProfile, item.id, item.login_id, item.content)
                        break
                    case 'posts':
                        ran = executeTask(taskPosts, item.id, item.login_id, item.content)
                        break
                    case 'download':
                        ran = executeTask(taskDownload, item.id, item.content)
                        break
                    case 'stories':
                        ran = executeTask(taskStories, item.id, item.login_id, item.content)
                        break
                    case 'contentToDownloadQueue':
                        ran = executeTask(taskContentToDownloadQueue, item.id)
                        break
                    default:
                        console.log('Item in queue is of unknown type', item)
                        queue.removeFromQueue(item.id)
                }

                resolve({ ran, item })

                if (numExecuting < config.maxConcurrentTasks) {
                    executeNext()
                }
            }).catch(err => console.log('executeNext error:', err))
        }
    })
}

eventer.on('addedToQueue', executeNext)

function executeTask(fn, queueId, ...args) {
    if (numExecuting >= config.maxConcurrentTasks) {
        console.log('Tried to executeTask when busy...', fn.name)
        return false
    } else {
        console.log('Executing task', queueId)
        tasksExecuting[queueId] = { queueId, fn, args }
        numExecuting++
        fn.apply(fn, [queueId, ...args])
        eventer.emit('taskExecuting', { queueId })
        return true
    }
}

async function executeCompleted(queueId, success=true) {
    // remove from queue
    if (success)
        await (queue.removeFromQueue(queueId))
    else
        console.log('WARNING: Task', queueId, 'was not successful!!!')
    
    tasksExecuting[queueId] = undefined
    numExecuting--

    eventer.emit('taskCompleted', { queueId, success })
    executeNext()
}



async function taskLogin(queueId, loginId) {
    try {
        let dbLogin = await (database.get('login', 'id', loginId))

        if (!(dbLogin && dbLogin.ds_user_id && dbLogin.sessionid)) {
            let cookies = await (instagram.login(dbLogin.username, dbLogin.password))
            await (database.update('login', cookies, 'id', loginId))
        }
    
        console.log('taskLogin completed')
        executeCompleted(queueId)
    } catch (e) {
        console.log('taskLogin error:', e)
        executeCompleted(queueId, false)
    }
}

async function taskProfile(queueId, loginId, username) {
    try {
        let dbLogin = await (database.get('login', 'id', loginId))

        if (!dbLogin || !dbLogin.ds_user_id || !dbLogin.sessionid) {
            console.log('taskProfile user not logged in')
            executeCompleted(queueId, false)
            return
        }

        if (!await (database.isUser(username)))
            await (database.addUser(username))

        user = await (database.getUser(username))

        let userData = await(instagram.getUser(user.username, dbLogin))

        let updatedUser = {
            instagram_id: userData.id,
            post_count: userData.edge_owner_to_timeline_media.count,
            followers_count: userData.edge_followed_by.count,
            following_count: userData.edge_follow.count,
            still_exists: 1,
            is_private: userData.is_private,
            is_verified: userData.is_verified,
            is_business: userData.is_business_account,
            business_email: userData.business_email,
            business_category: userData.business_category_name,
            business_phone: userData.business_phone_number,
            business_address: userData.business_address_json,
            username: userData.username,
            last_check: Date.now(),
        }

        await (database.update('user', updatedUser, 'id', user.id))

        let now = Date.now()
        let previous

        // user_real_name
        previous = await (database.query.get('SELECT * FROM user_real_name WHERE user_id = ? AND value = ?', user.id, userData.full_name))
        if (previous)  await (database.update('user_real_name', { last_seen:now }, 'id', previous.id))
        else           await (database.set('user_real_name', ['user_id', 'value', 'first_seen', 'last_seen'], [user.id, userData.full_name, now, now]))

        // user_biography
        previous = await (database.query.get('SELECT * FROM user_biography WHERE user_id = ? AND value = ?', user.id, userData.biography))
        if (previous)  await (database.update('user_biography', { last_seen:now }, 'id', previous.id))
        else           await (database.set('user_biography', ['user_id', 'value', 'first_seen', 'last_seen'], [user.id, userData.biography, now, now]))
    
        // user_web_page
        previous = await (database.query.get('SELECT * FROM user_web_page WHERE user_id = ? AND value = ?', user.id, userData.external_url))
        if (previous)  await (database.update('user_web_page', { last_seen:now }, 'id', previous.id))
        else           await (database.set('user_web_page', ['user_id', 'value', 'first_seen', 'last_seen'], [user.id, userData.external_url, now, now]))
    
        // user_profile_pic
        // TODO: domain will change even without picture change, have to check for md5 rather than url match
        previous = await (database.query.get('SELECT * FROM user_profile_pic WHERE user_id = ? AND url = ?', user.id, userData.profile_pic_url_hd))
        if (previous)  await (database.update('user_profile_pic', { last_seen:now }, 'id', previous.id))
        else           await (database.set('user_profile_pic', ['user_id', 'url', 'first_seen', 'last_seen'], [user.id, userData.profile_pic_url_hd, now, now]))

        // if (await (database.exists('SELECT * FROM subscription WHERE user_id = ? AND posts = 1'))) {
            // TODO: update the posts we get from userData
            // TODO: nevermind userData doesn't contain sideCar information (multiple media in one post)
        // }

        console.log('taskProfile completed')
        executeCompleted(queueId)
    } catch (e) {
        if (e.type === 'invalid-json') {
            if (user && user.id)
                await (database.update('user', { still_exists:0 }, 'id', user.id))
            else
                console.log('User ', username, ' does not exist')
            console.log('taskProfile completed')
            executeCompleted(queueId)
        } else {
            console.log('taskProfile error:', e)
            executeCompleted(queueId, false)
        }
    }
}

async function taskPosts(queueId, loginId, username) {
    try {
        let dbLogin = await (database.get('login', 'id', loginId))

        if (!dbLogin || !dbLogin.ds_user_id || !dbLogin.sessionid) {
            console.log('taskPosts user not logged in')
            executeCompleted(queueId, false)
            return
        }

        if (!await (database.isUser(username)))
            await (database.addUser(username))

        user = await (database.getUser(username))

        let codes = await (database.query.all('SELECT code FROM post WHERE user_id = ? AND id NOT IN (SELECT post_id FROM saved)', user.id))
        let previousCodes = codes.map(r => r.code)

        let posts = await(instagram.getUserPostsAll(username, dbLogin, previousCodes, user.instagram_id))

        posts = posts.reverse() // start saving last posts in case of interrupt

        if (posts.length > 0) {
            let postObjects = []
            posts.forEach(post => {
                let caption = null
                if (post.edge_media_to_caption.edges.length)
                    caption = post.edge_media_to_caption.edges[0].node.text
                postObjects.push([
                    post.shortcode,
                    user.id,
                    post.id,
                    post.taken_at_timestamp * 1000,
                    caption,
                    post.comments_disabled,
                    post.edge_media_to_comment.count,
                    post.edge_media_preview_like.count
                ])
            })

            await (database.setIgnore.apply(this, ['post', ['code', 'user_id', 'instagram_id', 'uploaded', 'caption', 'comments_disabled', 'comment_count', 'like_count'], ...postObjects]))

            for (let post of posts) {
                let dbPost = await (database.get('post', 'code', post.shortcode))

                if (!dbPost)
                    return

                let savedContent = 0

                if (post.__typename === 'GraphSidecar') {
                    if (post.edge_sidecar_to_children
                            && post.edge_sidecar_to_children.edges.length > 0) {
                        savedContent = 1
                        let valueArrays = []
                        post.edge_sidecar_to_children.edges.forEach(content => {
                            if (content.node.is_video) {
                                valueArrays.push([dbPost.id, content.node.id, content.node.dimensions.width, content.node.dimensions.height, 1, content.node.video_url, content.node.display_url])
                            } else {
                                valueArrays.push([dbPost.id, content.node.id, content.node.dimensions.width, content.node.dimensions.height, 0, content.node.display_url, null])
                            }
                        })
                        await (database.set.apply(database.set, ['content', ['post_id', 'instagram_id', 'width', 'height', 'is_video', 'media_url', 'preview_url'], ...valueArrays]))
                    }
                } else if (post.__typename === 'GraphImage') {
                    savedContent = 1
                    await (database.set('content', ['post_id', 'instagram_id', 'width', 'height', 'is_video', 'media_url'], [dbPost.id, post.id, post.dimensions.width, post.dimensions.height, 0, post.display_url]))
                } else if (post.__typename === 'GraphVideo') {
                    savedContent = 1
                    await (database.set('content', ['post_id', 'instagram_id', 'width', 'height', 'is_video', 'media_url', 'preview_url'], [dbPost.id, post.id, post.dimensions.width, post.dimensions.height, 1, post.video_url, post.display_url]))
                } else {
                    console.log('Post', post.code, 'is of unknown type', post.__typename)
                }

                if (post.edge_media_to_tagged_user.edges.length > 0) {
                    let valueArrays = []
                    for (let tagged of post.edge_media_to_tagged_user.edges) {
                        let dbUser = await (database.getUser(tagged.node.user.username))

                        if (dbUser) {
                            valueArrays.push([dbPost.id, tagged.node.user.id, tagged.node.user.username, tagged.node.x, tagged.node.y, dbUser.id])
                        } else {
                            valueArrays.push([dbPost.id, tagged.node.user.id, tagged.node.user.username, tagged.node.x, tagged.node.y, null])
                        }
                    }
                    await (database.set.apply(this, ['post_tagged_user', ['post_id', 'instagram_id', 'username', 'x', 'y', 'user_id'], ...valueArrays]))
                }

                if (savedContent !== dbPost.saved_content) {
                    await (database.update('post', { saved_content:1 }, 'id', dbPost.id))
                }
            }
        }

        console.log('taskPosts completed')
        executeCompleted(queueId)
    } catch (e) {
        console.log('taskPosts error:', e)
        executeCompleted(queueId, false)
    }
}

// async function taskPost(queueId, loginId, code) {
//     try {
//         let dbLogin = await (database.get('login', 'id', loginId))

//         if (!dbLogin || !dbLogin.ds_user_id || !dbLogin.sessionid) {
//             console.log('taskPosts user not logged in')
//             executeCompleted(queueId, false)
//             return
//         }

//         let post = await(instagram.getPost(code, dbLogin))
        

//         console.log('taskPost completed')
//         executeCompleted(queueId)
//     } catch (e) {
//         console.log('taskPost error:', e)
//         executeCompleted(queueId, false)
//     }
// }

async function taskDownload(queueId, contentId) {
    try {
        let content = await (database.get('content', 'id', contentId))

        if (content.stored_locally === 1) {
            console.log('Content with id', contentId, 'already stored locally')
            console.log('taskDownload completed')
            return executeCompleted(queueId)
        }

        let previewFilename, mediaFilename = await (utils.downloadMedia(content.media_url))
        console.log('Downloaded media', mediaFilename)

        let pathToMd5 = config.paths.storageFolder

        if (content.is_video === 1) {
            previewFilename = await (utils.downloadMedia(content.preview_url))
            console.log('Downloaded preview media', previewFilename)

            pathToMd5 = path.join(pathToMd5, previewFilename)
        } else {
            pathToMd5 = path.join(pathToMd5, mediaFilename)
        }

        let md5 = await (utils.hashFromFile(pathToMd5))
        console.log('Got md5', md5, 'from', pathToMd5)

        await (database.update('content', {
            stored_locally: 1,
            preview_filename:previewFilename,
            media_filename:mediaFilename,
            md5
        }, 'id', content.id))

        console.log('taskDownload completed')
        executeCompleted(queueId)
    } catch (e) {
        console.log('taskDownload error:', e)
        executeCompleted(queueId, false)
    }
}

async function taskStories(queueId, loginId, username) {
    try {
        let dbLogin = await (database.get('login', 'id', loginId))

        if (!dbLogin || !dbLogin.ds_user_id || !dbLogin.sessionid) {
            console.log('taskPosts user not logged in')
            executeCompleted(queueId, false)
            return
        }

        if (!await (database.isUser(username)))
            await (database.addUser(username))

        user = await (database.getUser(username))

        let stories = await(instagram.getStories(username, dbLogin, user.instagram_id))

        if (stories) {
            let storyObjects = []
            for (let story of stories.items) {
                let previewUrl, mediaUrl, pathToMd5 = config.paths.storageFolder

                if (story.is_video === 1) {
                    previewUrl = story.display_url
                    for (let vidRes of story.video_resources) {
                        if (vidRes.profile === 'MAIN') {
                            mediaUrl = vidRes.src
                            break;
                        }
                    }
                } else {
                    mediaUrl = story.display_url
                }

                if (await (utils.mediaExists(mediaUrl))) {
                    continue
                }

                let previewFilename, mediaFilename = await (utils.downloadMedia(mediaUrl))
                console.log('Downloaded media', mediaFilename)

                if (previewUrl) {
                    previewFilename = await (utils.downloadMedia(previewUrl))
                    console.log('Downloaded preview media', previewFilename)
                    pathToMd5 = path.join(pathToMd5, previewFilename)
                } else {
                    pathToMd5 = path.join(pathToMd5, mediaFilename)
                }

                let md5 = await (utils.hashFromFile(pathToMd5))
                console.log('Got md5', md5, 'from', pathToMd5)

                storyObjects.push([
                    user.id,
                    story.id,
                    story.taken_at_timestamp,
                    story.dimensions.width,
                    story.dimensions.height,
                    story.is_video ? 1 : 0,
                    md5,
                    mediaFilename,
                    previewFilename
                ])
            }
            if (storyObjects.length > 0) {
                console.log('Downloaded', storyObjects.length, 'new stories from user', user.username)
                await (database.setIgnore.apply(this, ['story', ['user_id', 'instagram_id', 'uploaded', 'width', 'height', 'is_video', 'md5', 'media_filename', 'preview_filename'], storyObjects]))
            } else {
                // stories already downloaded
            }
        } else {
            // no stories
        }

        console.log('taskStories completed')
        executeCompleted(queueId)
    } catch (e) {
        console.log('taskStories error:', e)
        executeCompleted(queueId, false)
    }
}

async function taskContentToDownloadQueue(queueId) {
    try {
        await (Database.query.run('INSERT OR IGNORE INTO queue (type, content) SELECT "download", id FROM content WHERE LENGTH(media_url) > 0 AND stored_locally = 0'))
        
        console.log('taskContentToDownloadQueue completed')
        executeCompleted(queueId)
    } catch (e) {
        console.log('taskContentToDownloadQueue error:', e)
        executeCompleted(queueId, false)
    }
}