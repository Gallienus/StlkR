const Crawl = require('./Crawl')
const Database = require('./Database')
const Util = require('./Util')

const fs   = require('fs')
const path = require('path')

const config = require('../config')
const u = config.username, p = config.password

async function updateMySaved() {
    let rows = await Database.getSaved()
    let previouslySaved = rows.map(r => r.code)
    let data = await Crawl.getSavedPosts(u, p, previouslySaved)
    if (data.posts.length > 0) {
        let res = await Database.addSaved.apply(null, data.posts)
        console.log('Could save', data.posts.length, 'new posts -', res)
        Database.end()
    } else
        console.log('No new saved posts')
}
// updateMySaved()

async function addSavedToQueue() {
    let codes = await (Database.getSaved())
    let stmt = Database.db.prepare(`INSERT OR IGNORE INTO queue (type,content) SELECT "post",code FROM saved WHERE code NOT IN (SELECT code FROM post)`)
    stmt.run(err => {
        if (err) console.log('Error:', err)
        else     console.log('Moved successfully')
    })
}
// addSavedToQueue()

async function doNextInQueue() {
    return new Promise((resolve, reject) => {
        // let stmt = Database.db.prepare(`SELECT * FROM queue WHERE length(content) < 15 AND type = "post"`)
        // let stmt = Database.db.prepare(`SELECT * FROM queue WHERE type = "profile"`)
        let stmt = Database.db.prepare('SELECT * FROM queue')
        stmt.get(async function(err, row) {
            if (err) throw err
            if (!row) return reject('empty queue')
    
            try {
                console.log('Next in queue is:', row)
                if (row.type === 'post') {
    
                    var post
    
                    if (await (Database.isPostByCode(row.content))) {
                        post = await (Database.getPostByCode(row.content))
                        if (post.saved_content) {
                            console.log('The post had already been saved')
                            await (Database.deleteQueue(row.id))
                            return
                        }
                    }

                    await (Crawl.doLogin(u, p))
                    
                    let postData = await (Crawl.getPost(row.content))

                    if (postData.error) {
                        await (Database.deleteQueue(row.id))
                        return resolve(postData.error)
                    }
                                        
                    if (!await (Database.isUser(postData.uploader))) {
                        await (Database.addUser(postData.uploader))
                        await (Database.addToQueue('profile', postData.uploader))
                    }
    
                    let user = await (Database.getUser(postData.uploader))
    
                    if (!post)
                        await (Database.addPost(row.content, user, { still_exists: true, uploaded: postData.uploaded, caption: postData.description }))
                    
                    post = await (Database.getPostByCode(row.content))
                    
                    await (Database.deleteQueue(row.id))
                    
                    postData.media.forEach(async function(media) {
                        await (Database.addPostContent(post, {
                            media_url: media.media,
                            preview_url: media.preview,
                            is_video: media.type === 'video'
                        }))
                    })
                    await (Database.update('post', {'saved_content': true}, 'id', post.id))

                    console.log('Done')
                    resolve()
                }

                else if (row.type === 'profile') {

                    // row = { id: -1, content: 'grachel03' }

                    let username = row.content

                    if (!await (Database.isUser(username))) {
                        await (Database.addUser(username))
                    }

                    let user = await (Database.getUser(username))

                    let stmt = Database.db.prepare('SELECT code FROM post WHERE user_id = ?')
                    stmt.all(user.id, async function(err, codes) {
                        let previousPosts = codes.map(r => r.code)

                        let profileData = await (Crawl.getProfile(user.username, previousPosts, false))

                        let updObj = { still_exists: false }
                        if (!profileData.error) {
                            let fn = await (Util.downloadMedia(profileData.profilePictureUrl))

                            updObj = {
                                post_count: profileData.postCount,
                                followers_count: profileData.followersCount,
                                following_count: profileData.followingCount,
                                biography: profileData.biography,
                                real_name: profileData.realName,
                                webpage: profileData.webpage,
                                is_private: profileData.isPrivate,
                                profile_pic_url: profileData.profilePictureUrl,
                                profile_pic_filename: fn
                            }
                        }

    
                        Database.update('user', updObj, 'id', user.id).then(() => {
                            let done = async function() {
                                await (Database.deleteQueue(row.id))
                                resolve(true)
                            }
                            
                            if (profileData.posts && profileData.posts.length > 0) {
                                let rawValues = ''
                                profileData.posts.forEach(code => {
                                    rawValues += `("${code}", ${user.id}),`
                                })
                                rawValues = rawValues.slice(0,-1)
                                let raw = `INSERT OR IGNORE INTO post (code, user_id) VALUES ${rawValues}`
                                // console.log('Query:', raw)
                                let stmt = Database.db.prepare(raw)
                                stmt.run(async function(err) {
                                    if (err) reject(err)
                                    else {
                                        done()
                                    }
                                })
                            } else {
                                done()
                            }
                        }).catch(err => {
                            reject(err)
                        })
                    })
                }
            } catch (e) {
                console.log('Encountered error', e)
                reject(e)
            }
        })
    })
}
// doNextInQueue()
function doNInQueue(n) {
    var a = 0 + n
    let next = () => {
        console.log(a, 'iterations left')
        a--
        if (a < 0) {
            console.log('All', n, 'iterations are finished!')
            Crawl.end()
            return
        }
        doNextInQueue().then(() => {
            next()
        }).catch(err => {
            console.log('Ran into error', err)
            Crawl.end()
        })
    }

    next()
}
// doNInQueue(1000)

function downloadContent() {
    let stmt = Database.db.prepare('SELECT * FROM content WHERE stored_locally = "false"')
    stmt.all((err, rows) => {
        if (err) throw err

        console.log('Got', rows.length, 'to download')

        var indx = 0
        let next = async function() {
            try {
                if (indx >= rows.length) {
                    console.log('We are done')
                } else {
                    console.log(`${indx}/${rows.length}`)
    
                    let content = rows[indx]
    
                    let fileName = await (Util.downloadMedia(content.media_url))
                    console.log('Downloaded file', fileName)
    
                    if (content.is_video === 'true') {
                        let previewName = await (Util.downloadMedia(content.preview_url))
                        console.log('Downloaded preview for video', previewName)
                    }
    
                    await (Database.update('content', {'stored_locally': true}, 'id', rows[indx].id))
                    indx++
                    next()
                }
            } catch (e) {
                console.log('Oh noees, something went wrong when downloading', rows[indx], e)
            }
        }

        next()
    })
}
// downloadContent()

function verifyLocallyStoredContent() {
    let stmt = Database.db.prepare('SELECT * FROM content')
    stmt.all((err, rows) => {
        if (err) throw err

        console.log(`Checking ${rows.length} contents`)

        rows.forEach((row, index) => {
            let fileName = Util.fileNameFromUrl(row.media_url)
            let filePath = path.join(__dirname, '..', config.storageFolder.relativePath, fileName)
        
            if (!fs.existsSync(filePath)) {
                console.log('Problem', filePath)
            }

            if (row.is_video === 'true') {
                fileName = Util.fileNameFromUrl(row.preview_url)
                filePath = path.join(__dirname, '..', config.storageFolder.relativePath, fileName)

                if (!fs.existsSync(filePath)) {
                    console.log('Problem with preview', filePath)
                }
            }
        })

        console.log('Done')
    })
}
// verifyLocallyStoredContent()
const {
    getStories,
    getStoriesFeed,
    getMediaByCode,
    getUserByUsername
  } = require('instagram-stories')

async function testThis() {
    let username = 'emily.feld'
    // let cookies = { sessionId:{value:'IGSC7c3ca320c906c4557ebab0e9a04bc195e5a147f3bdb153d051dc4ac1f22385aa%3AAGAFgFjAuR9z5JnY3TJVkd4PJAe7phk1%3A%7B%22_auth_user_id%22%3A449730200%2C%22_auth_user_backend%22%3A%22accounts.backends.CaseInsensitiveModelBackend%22%2C%22_auth_user_hash%22%3A%22%22%2C%22_platform%22%3A4%2C%22_token_ver%22%3A2%2C%22_token%22%3A%22449730200%3A2DG5AWMbmiKK1qiBhkypIiCqAHikYWhM%3A7585c6c0541f91eb5634173539dd8924ebd8b3fdc34426b39bb91c7c37fe05ac%22%2C%22last_refreshed%22%3A1529795863.6330747604%7D'}, userId:{value:'449730200'}}
    // fetch(`https://www.instagram.com/${username}/?__a=1`, {
    //     headers: { Cookie: `sessionid=${cookies.sessionId.value}; ds_user_id=${cookies.userId.value}` }
    // }).then(res => res.json()).then(json1 => {
    //     let user = json1.graphql.user
    //     let alienId = user.id
        let alienId = 3461532344
        alienId = 300728572
        fetch(`https://i.instagram.com/api/v1/feed/user/${alienId}/reel_media/`, {
            // headers: { Cookie: `sessionid=${cookies.sessionId.value}; ds_user_id=${cookies.userId.value}` }
            headers: {
                cookie: 'fbm_124024574287414=base_domain=.instagram.com; csrftoken=KppJedBPSr4ZKL2S1R7CIa8HcVMNrecH; ds_user_id=449730200; sessionid=IGSC7c3ca320c906c4557ebab0e9a04bc195e5a147f3bdb153d051dc4ac1f22385aa%3AAGAFgFjAuR9z5JnY3TJVkd4PJAe7phk1%3A%7B%22_auth_user_id%22%3A449730200%2C%22_auth_user_backend%22%3A%22accounts.backends.CaseInsensitiveModelBackend%22%2C%22_auth_user_hash%22%3A%22%22%2C%22_platform%22%3A4%2C%22_token_ver%22%3A2%2C%22_token%22%3A%22449730200%3A2DG5AWMbmiKK1qiBhkypIiCqAHikYWhM%3A7585c6c0541f91eb5634173539dd8924ebd8b3fdc34426b39bb91c7c37fe05ac%22%2C%22last_refreshed%22%3A1529795863.6330747604%7D; shbid=3492; mid=Wy0gNAAEAAEu8orl27WOloTixmra; rur=FRC; urlgen="{\"time\": 1529774980\054 \"2001:2002:5ae0:ad0c:8953:4a9a:eecc:e165\": 3301\054 \"90.224.173.12\": 3301}:1fX64R:biE6Y6BiVU8Jk3jMiLuyvHwis_g"; mcd=3; fbsr_124024574287414=4w5rCK4ugm7ihndWfkNpQayAvBSTf9DdbbiwzIsRHXo.eyJhbGdvcml0aG0iOiJITUFDLVNIQTI1NiIsImNvZGUiOiJBUUJyUTRtS2xLU0FtelhtNUtBaFNfOTFtNk1HdFpUelE2TU0yb2xSd2ltXzZwTkdtVVYxQVBFSnJVWlY0LWJTY3lHZ2xXdmhHa0hnWnpVNEdWTmUwSjY4MEtXbXBiZW9PajhYTTVHbllBMTBSaHE1LU9sZ2VadTdPcWl4V3ZwdXNqSjV3aVlvbGRBSGNMMFQ4UEtfZ2lBc1lyZEJ3Rl9XbDF0eFBJb01fZ1RFTm1YOHhSc1ctVnVfNU5YRnlCYkRXRjJ3ZWxuc2dYTEVUTkJ4UWN6STNXZ2lSdnFJN2N0UTB2dzQ5REt0cXRrSWRqeG1ueUpvRVN3XzJram50SHA4dW9BNFRTUGxqd0lkVFRQenNOU3l6OVVjLUM2UzhhWUhJdm93d1Z4d3Z0cVZDSURfUU4xeUZ5ZzFqTkJURkJyZnhQSXJiTkN3MzMtZ2Q1MER1SWoyQVNvbDN2T2E2WFhQR1lnQW5aNTZKVUN4R05yS2JuUTVvbTRmdUhIMWFzVTlONWciLCJpc3N1ZWRfYXQiOjE1Mjk4NTE0OTEsInVzZXJfaWQiOiIxMDAwMDAzMzY4NDAxMTAifQ; ig_cb=1; shbts=1529850771.0230973',
                'user-agent': 'Instagram 9.5.1 (iPhone9,2; iOS 10_0_2; en_US; en-US; scale=2.61; 1080x1920) AppleWebKit/420+',
                // 'x-ig-capabilities': '3w==',
                // host: 'i.instagram.com'
            }
        }).then(re => re.json())
            .then(json => console.log(json.items[1].video_versions))
    // })
}
// testThis()


function fixNumbersInDatabase() {
    Database.getAll('user', 1, 1).then(users => {
        users.forEach(user => {
            let stmt = Database.db.prepare(`UPDATE user SET ('post_count','followers_count','following_count') = (?,?,?) WHERE id = ?`)
            stmt.run(
                Util.fixNumberInString(user.postCount),
                Util.fixNumberInString(user.followersCount),
                Util.fixNumberInString(user.followingCount),
                user.id,
                err => {
                    if (err) console.log('Bad', err)
                    else console.log('Updated', user.id)
                }
            )
        })
    })
}
// fixNumbersInDatabase()

function fixProfilePics() {
    Database.db.prepare(`SELECT * FROM user WHERE profile_pic_url NOT null AND profile_pic_filename IS null`).all((err, rows) => {
        if (err) throw err
        else {
            let i = 0

            let next = () => {
                if (i >= rows.length)
                    return console.log('Reached end')
                else {
                    let row = rows[i++]

                    console.log(`${i}/${rows.length}`, 'Downloading pic for user', row.username)

                    Util.downloadMedia(row.profile_pic_url).then(filename => {
                        Database.update('user', {
                            profile_pic_filename: filename
                        }, 'id', row.id).then(() => {
                            next()
                        }).catch(err => {
                            console.log('Could not update db???', err)
                        })
                    }).catch(err => console.log('Could not download media', err))

                }
            }

            next()
        }
    })
}
// fixProfilePics()

function fixContent() {
    Database.db.prepare(`SELECT * FROM content WHERE stored_locally = 1 AND image_hash = null`).all((err, rows) => {
        if (err) console.log('Bad', err)
        else {
            let indx = 0

            let next = () => {
                if (indx >= rows.length)
                    return console.log('Reached end')
                else {
                    let row = rows[indx++]
                    
                    let previewFilename = Util.fileNameFromUrl(row.preview_url)
                    let mediaFilename = Util.fileNameFromUrl(row.media_url)
                    
                    let pathToHash = 'storage/'
                    
                    if (row.is_video === 'true')
                    pathToHash += previewFilename
                    else
                    pathToHash += mediaFilename
                    
                    console.log(`${indx}/${rows.length}`, 'Getting hash from', pathToHash)
                    
                    Util.hashFromFile(pathToHash).then(hash => {
                        Database.update('content', {
                            preview_filename: previewFilename,
                            media_filename: mediaFilename,
                            image_hash: hash
                        }, 'id', row.id).then(() => {
                            next()
                        }).catch(err => {
                            console.log('Could not update db???', err)
                        })
                    }).catch(err => {
                        console.log('could not hash image???', err)
                    })
                }
            }

            next()
        }
    })
}
// fixContent()


// console.log(Database.db.escape('helloOWOrld&;AND" quit;'))



// fbm_124024574287414=base_domain=.instagram.com; csrftoken=KppJedBPSr4ZKL2S1R7CIa8HcVMNrecH; ds_user_id=449730200; sessionid=IGSC7c3ca320c906c4557ebab0e9a04bc195e5a147f3bdb153d051dc4ac1f22385aa%3AAGAFgFjAuR9z5JnY3TJVkd4PJAe7phk1%3A%7B%22_auth_user_id%22%3A449730200%2C%22_auth_user_backend%22%3A%22accounts.backends.CaseInsensitiveModelBackend%22%2C%22_auth_user_hash%22%3A%22%22%2C%22_platform%22%3A4%2C%22_token_ver%22%3A2%2C%22_token%22%3A%22449730200%3A2DG5AWMbmiKK1qiBhkypIiCqAHikYWhM%3A7585c6c0541f91eb5634173539dd8924ebd8b3fdc34426b39bb91c7c37fe05ac%22%2C%22last_refreshed%22%3A1529795863.6330747604%7D