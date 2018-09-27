const config = require('../config')

const Database = require('./Database')

const fetch = require('node-fetch');
const Nightmare = require('nightmare')

const nightmare = Nightmare({ show:config.showWindow, alwaysOnTop:false, typeInterval:20, executionTimeout:500000, webPreferences: { images:false }})
const getNightmare = () => nightmare

var credentials = { login:null, password:null }
const getCredentials = () => credentials
const setCredentials = (login, password) => {
    return new Promise((resolve, reject) => {
        credentials = { login, password }
        if (!isLoggedInTo(login)) {
            doLogin(login, password)
                .then(resolve)
                .catch(reject)
        } else {
            resolve(true)
        }
    })
}

var cookie = null
const getCookie = () => cookie
const getCookieHeader = () => cookie ? `sessionid=${cookie.sessionId}; ds_user_id=${cookie.dsUserId}` : null
const setCookie = (newCookie) => cookie = newCookie

var loggedInTo      = null
const getLoggedInTo = () => loggedInTo
const isLoggedIn    = () => loggedInTo !== null
const isLoggedInTo  = login => login === loggedInTo

var busy = false

function notBusy() {
    if (busy) { return false
    } else {    busy = true
                return true }
}

function taskIsOver(fn, data) {
    busy = false
    fn(data)
}

function doFetch(url) {
    return new Promise((resolve, reject) => {
        console.log('Doing fetch...', url)
        let headers = { 'Cookie': getCookieHeader(), 'User-Agent': config.userAgent }
        fetch(url, { headers:headers }).then(r => r.json())
            .then(resolve)
            .catch(reject)
    })
}





function getProfileInfo(username) {
    return new Promise((resolve, reject) => {
        if (!isLoggedIn()) return reject('not logged in')
        doFetch(`https://www.instagram.com/${username}/?__a=1`).then(json => {
            let user = json.graphql.user
            resolve({
                username:          user.username,
                instagramId:       user.id,
                biography:         user.biography,
                webpage:           user.external_url,
                postCount:         user.edge_owner_to_timeline_media.count,
                followersCount:    user.edge_followed_by.count,
                followingCount:    user.edge_follow.count,
                realName:          user.full_name,
                isPrivate:         user.is_private,
                profilePictureUrl: user.profile_pic_url_hd,
            })
        }).catch(reject)
    })
}

function getPostInfo(code) {
    return new Promise((resolve, reject) => {
        if (!isLoggedIn()) return reject('not logged in')
        doFetch(`https://www.instagram.com/p/${code}/?__a=1`).then(json => {
            let post = json.graphql.shortcode_media
            let obj = {
                code: post.shortcode,
                description: post.edge_media_to_caption.edges.map(e => e.node.text).join('\n'),
                likeCount: post.edge_media_preview_like.count,
                commentCount: post.edge_media_to_comment.count,
                uploaded: post.taken_at_timestamp * 1000,
                uploader: post.owner.username,
            }

            let doMedia = node => {
                if (node.is_video) return {
                    isVideo: true,
                    viewCount: node.video_view_count,
                    preview: node.display_url,
                    media: node.video_url }
                else return {
                    isVideo: false,
                    media: node.display_url }
            }

            obj.mentions2 = []

            let doMentions = node => {
                if (node.edge_media_to_tagged_user) return {
                    code:node.shortcode,
                    mentions:node.edge_media_to_tagged_user.edges.map(edge => ({
                        username:edge.node.user.username, 
                        x:edge.node.x, y:edge.node.y })) }
                else return {
                    code:node.shortcode,
                    mentions:[] }
            }

            if (post.edge_sidecar_to_children) {
                obj.media    = post.edge_sidecar_to_children.edges.map(edge => doMedia(edge.node)   )
                obj.mentions = post.edge_sidecar_to_children.edges.map(edge => doMentions(edge.node))
            } else {
                obj.media    = [ doMedia(post)    ]
                obj.mentions = [ doMentions(post) ]
            }

            resolve(obj)
        }).catch(reject)
    })
}

function getStories(username) {
    return new Promise((resolve, reject) => {
        if (!isLoggedIn()) return reject('not logged in')
        Database.getUser(username).then(user => {
            let targetId = user.instagram_id
            let next = () => {
                doFetch(`https://i.instagram.com/api/v1/feed/user/${targetId}/reel_media/`)
                    .then(json => {
                        let stories = []
                        if (json.items) {
                            json.items.forEach(item => {
                                let obj = {
                                    userId:user.id,
                                    uploaded:item.taken_at * 1000,
                                    isVideo: item.media_type === '2' }
                                if (obj.isVideo) {
                                    obj.previewUrl = item.image_versions2.candidates[0].url
                                    obj.mediaUrl = item.video_versions[0].url
                                } else
                                    obj.mediaUrl = item.image_versions2.candidates[0].url
                                stories.push(obj)
                            })
                        }
                        resolve(stories)
                    }).catch(reject)
            }
            if (!targetId)
                doFetch(`https://www.instagram.com/${username}/?__a=1`)
                    .then(json => {
                        targetId = json.graphql.user.id
                        next()
                    }).catch(reject)
            else
                next()
        }).catch(reject)
    })
}





function getProfilePosts(username, previousPosts) {
    return new Promise((resolve, reject) => {
        if (notBusy())
            nightmare
                .goto(`https://instagram.com/${username}/`)
                .evaluate((querySelectors, previousPosts) => {
                    return new Promise((resolve, reject) => {
                        var data = {}
                        try {
                            if (document.querySelector(querySelectors.errorContainer) !== null)
                                return resolve({ error:'404' })

                            data.posts = []
                            data.numberOfNew = 0
        
                            var runOnce = true
                            let next = () => {
                                if (runOnce || document.querySelector(querySelectors.uploadsListLoadingWheel) !== null) {
                                    runOnce = false
                                    let links = document.querySelectorAll(querySelectors.uploadsListPosts)
                                    for (let i = 0; i < links.length; i++) {
                                        let code = /instagram\.com\/p\/(.*?)\//.exec(links[i].href)[1]
                                        if (previousPosts.indexOf(code) > -1) {
                                            resolve(data)
                                            return
                                        } else {
                                            if (data.posts.indexOf(code) < 0) {
                                                data.posts.push(code)
                                                data.numberOfNew++
                                            }
                                        }
                                    }
                                    window.scrollTo(0, window.scrollY + 895)
                                    console.log('Posts fetched...', data.posts.length)
                                    setTimeout(next, 10000)
                                } else {
                                    resolve(data)
                                }
                            }
                            
                            next()
                        } catch(e) {
                            console.log('Encountered an error!', e)
                            reject(e)
                        }
                    })
                }, config.querySelectors, previousPosts)
                // .end()
                .then(data => {
                    taskIsOver(resolve, data)
                })
                .catch(error => {
                    data.error = error
                    taskIsOver(reject, data)
                })
        else
            taskIsOver(reject, 'busy')
    })
}

function getSavedPosts(previousPosts=[]) {
    return new Promise((resolve, reject) => {
        if (notBusy())
            if (isLoggedIn) {
                nightmare
                    .evaluate(() => {
                        return !!document.querySelector('.coreSpriteDesktopNavProfile')
                    })
                    .then(rightPage => {
                        console.log('ARE WE ON THE RIGHT PAGE:', rightPage)
                        let next = () => {
                            nightmare
                                .evaluate(() => {
                                    location.href = document.querySelector('.coreSpriteDesktopNavProfile').href + 'saved'
                                })
                                .wait(() => {
                                    return document.body.innerHTML.indexOf('Only you can see') > -1
                                })
                                .wait(1000)
                                .evaluate((querySelectors, previousPosts) => {
                                    return new Promise((resolve, reject) => {
                                        var data = {}
                                        try {
                                            data.posts = []
                                            data.numberOfNew = 0
                                            var runOnce = true
                                            let next = () => {
                                                if (runOnce || document.querySelector(querySelectors.uploadsListLoadingWheel) !== null) {
                                                    runOnce = false
                                                    let links = document.querySelectorAll(querySelectors.uploadsListPosts)
                                                    for (let i = 0; i < links.length; i++) {
                                                        let code = /instagram\.com\/p\/(.*?)\//.exec(links[i].href)[1]
                                                        if (previousPosts.indexOf(code) > -1) {
                                                            resolve(data)
                                                            return
                                                        } else {
                                                            if (data.posts.indexOf(code) < 0) {
                                                                data.posts.push(code)
                                                                data.numberOfNew++
                                                            }
                                                        }
                                                    }
                                                    window.scrollTo(0, window.scrollY + 895)
                                                    console.log('Posts fetched...', data.posts.length)
                                                    setTimeout(next, 100)
                                                } else {
                                                    resolve(data)
                                                }
                                            }
                                            next()
                                        } catch(e) {
                                            reject(e)
                                        }
                                    })
                                }, config.querySelectors, previousPosts)
                                // .end()
                                .then(data => {
                                    taskIsOver(resolve, data)
                                })
                                .catch(err => {
                                    taskIsOver(reject, err)
                                })
                        }
                        if (!rightPage) {
                            nightmare
                                .goto('https://instagram.com/')
                                .wait('.coreSpriteDesktopNavProfile')
                                .then(next)
                                .catch(err => taskIsOver(reject, err))
                        } else
                            next()
                    })
                    .catch(err => taskIsOver(reject, err))
            } else {
                console.log('Not signed in')
                taskIsOver(reject, err)
            }
        else
            reject('busy')
    })
}





function doLogin(login, password) {
    return new Promise((resolve, reject) => {
        if (!notBusy())          return taskIsOver(reject, 'busy')
        if (isLoggedInTo(login)) return taskIsOver(resolve, false)

        Database.query.get('SELECT * FROM cookie WHERE login = ?', login)
            .then(dbCookie => {
                if (dbCookie) {
                    loggedInTo = login
                    setCookie({ sessionId:dbCookie.sessionid, dsUserId:dbCookie.ds_user_id })
                    nightmare
                        .goto('javascript:void(0)')
                        .goto('https://www.instagram.com/')
                        // .cookies.set('sessionid', dbCookie.sessionid)
                        // .cookies.set('ds_user_id', dbCookie.ds_user_id)
                        .cookies.set({
                            name: 'sessionid',
                            value: dbCookie.sessionid,
                            // value: 'IGSC13c8c31217cac780bf267428b88def953914088f08e92418184be1b05c8c660a%3AQexRWdsqqyRloXhQBd4N9PTve31JACvt%3A%7B%22_auth_user_id%22%3A449730200%2C%22_auth_user_backend%22%3A%22accounts.backends.CaseInsensitiveModelBackend%22%2C%22_auth_user_hash%22%3A%22%22%2C%22_platform%22%3A4%2C%22_token_ver%22%3A2%2C%22_token%22%3A%22449730200%3AGljgaobNA1HRo88lW96H0fEPqwrZOKm8%3A453c2c37196a84d61af69685bbf9960b9a0a9424a9b1fc3c1e02372f61b20744%22%2C%22last_refreshed%22%3A1529883563.3472239971%7D',
                            domain: '.instagram.com',
                            hostOnly: false,
                            path: '/',
                            secure: true,
                            httpOnly: true,
                            session: false,
                            // expirationDate: 1537659563.440748
                        })
                        .cookies.set({
                            name: 'ds_user_id',
                            // value: '449730200',
                            value: dbCookie.ds_user_id,
                            domain: '.instagram.com',
                            hostOnly: false,
                            path: '/',
                            secure: false,
                            httpOnly: false,
                            session: false,
                            // expirationDate: 1537659563.851041
                        })
                        .then((  ) => taskIsOver(resolve, true))
                        .catch(err => taskIsOver(reject, err))
                } else {
                    nightmare
                        .goto('https://www.instagram.com/accounts/login/')
                        .wait('input[type=text]')
                        .type('input[type=text]', login)
                        .type('input[type=password]', password + '\u000d')
                        .wait('.coreSpriteDesktopNavProfile')
                        .cookies.get('sessionid')
                        .then(nSessionId => {
                            nightmare
                                .cookies.get('ds_user_id')
                                .then(nDsUserId => {
                                    loggedInTo = login
                                    setCookie({ sessionId:nSessionId.value, dsUserId:nDsUserId.value })
                                    Database.set('cookie', ['sessionid', 'ds_user_id', 'login'], [nSessionId.value, nDsUserId.value, login])
                                        .then(() => taskIsOver(resolve, true))
                                        .catch(err => taskIsOver(reject, err))
                                }).catch(err => taskIsOver(reject, err))
                        }).catch(err => taskIsOver(reject, err))
                }
            }).catch(err => taskIsOver(reject, err))
    })
}

function end() {
    return new Promise((resolve, reject) => {
        nightmare
            .halt('intended halt', () => {
                loggedInTo = false
                taskIsOver(resolve, true)
            })
    })
}

module.exports = {
    getCookie,
    getCookieHeader,
    getCredentials,
    getLoggedInTo,
    getNightmare,
    isLoggedIn,
    isLoggedInTo,
    setCredentials,

    getPostInfo,
    getProfileInfo,
    getStories,

    getProfilePosts,
    getSavedPosts,

    doLogin,
    end,
}