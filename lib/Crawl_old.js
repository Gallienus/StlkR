const config = require('../config')

const Nightmare = require('nightmare')
const nightmare = Nightmare({ show:config.showWindow, executionTimeout:500000, webPreferences: { images:false }})

var isLoggedIn = false
const getIsLoggedIn = () => isLoggedIn

var busy       = false

function notBusy() {
    if (busy) {
        return false
    } else {
        busy = true
        return true
    }
}

function taskIsOver(fn, data) {
    busy = false
    fn(data)
}

function getPost(postID) {
    return getPostFromURL(`https://instagram.com/p/${postID}/`)
}

function getPostFromURL(url, grabContent=true) {
    return new Promise((resolve, reject) => {
        if (notBusy())
            nightmare
                .goto(url)
                .wait((querySelectors) => {
                    return (document.querySelector(querySelectors.errorContainer) !== null ||
                                (document.querySelector(querySelectors.imageSrc) &&
                                    document.querySelector(querySelectors.imageSrc).src.length > 0))
                }, config.querySelectors)
                .evaluate((querySelectors, grabContent) => {
                    return new Promise((resolve, reject) => {
                        try {
                            if (document.querySelector(querySelectors.errorContainer) !== null)
                                return resolve({ error:'404' })

                            var data = {}
                            if (document.querySelector(querySelectors.imageDescription))
                                data.description = document.querySelector(querySelectors.imageDescription).innerText
                            else
                                data.description = ''

                            data.uploaded = new Date(/datetime=\"(.*?)\"/.exec(document.querySelector(querySelectors.uploadedDate).parentNode.innerHTML)[1]).getTime()
                            data.uploader = document.querySelector(querySelectors.uploaderName).title
                            
                            if (document.querySelector('article > div > div > ul > li > a > span')) {
                                data.commentCount = document.querySelector('article > div > div > ul > li > a > span').innerText
                                data.commentCount = parseInt(data.commentCount.replace(/[,.]/g, ''))
                            } else
                                data.commentCount = document.querySelectorAll('article > div > div > ul > li').length
                            
                            if (document.querySelector('article > div > section > div > a > span, article > div > section > div > span > span')) {
                                data.likeCount = document.querySelector('article > div > section > div > a > span, article > div > section > div > span > span').innerText
                                data.likeCount = parseInt(data.likeCount.replace(/[,.]/g, ''))
                            }
                            
                            data.media = []
                            data.mentions = []

                            let next = () => {
                                let media = {}
                                if (document.querySelector(querySelectors.videoSrc) !== null) {
                                    media.type = 'video'
                                    media.preview = document.querySelector(querySelectors.imageSrc).src
                                    media.media = document.querySelector(querySelectors.videoSrc).src
                                } else {
                                    media.type = 'image'
                                    media.media = document.querySelector(querySelectors.imageSrc).src
                                }
                                data.media.push(media)

                                data.mentions = data.mentions.concat([...document.querySelectorAll('article > div > div > div > div > div > a')].map(i => i.innerText))

                                if (document.querySelector(querySelectors.rightButton) !== null) {
                                    document.querySelector(querySelectors.rightButton).click()
                                    setTimeout(next, 100)
                                } else {
                                    resolve(data)
                                }
                            }
                            
                            if (grabContent) {
                                next()
                            } else {
                                resolve(data)
                            }
                        } catch(e) {
                            reject(e)
                        }
                    })
                }, config.querySelectors, grabContent)
                // .end()
                .then(data => {
                    taskIsOver(resolve, data)
                })
                .catch(error => {
                    taskIsOver(reject, error)
                })
        else
            taskIsOver(reject, 'busy')
    })
}

function getProfile(username, previousPosts, grabPosts) {
    return getProfileFromURL(`https://instagram.com/${username}/`, previousPosts, grabPosts)
}

// previousPosts is array of post IDs
function getProfileFromURL(url, previousPosts=[], grabPosts=true) {
    return new Promise((resolve, reject) => {
        if (notBusy())
            nightmare
                .goto(url)
                .evaluate((querySelectors, previousPosts, grabPosts) => {
                    return new Promise((resolve, reject) => {
                        var data = {}
                        try {
                            if (document.querySelector(querySelectors.errorContainer) !== null)
                                return resolve({ error: '404' })

                            data.profilePictureUrl = document.querySelector(querySelectors.profilePicture).src/* .replace(/150x150/, '320x320') */

                            data.username = document.querySelector(querySelectors.profileUsername).innerText
                            data.postCount = document.querySelector(querySelectors.profilePostCount).innerText
                            data.followersCount = document.querySelector(querySelectors.profileFollowersCount).title
                            data.followingCount = document.querySelector(querySelectors.profileFollowingCount).innerText
                            
                            data.postCount = parseInt(data.postCount.replace(/[,.]/g, ''))
                            data.followersCount = parseInt(data.followersCount.replace(/[,.]/g, ''))
                            data.followingCount = parseInt(data.followingCount.replace(/[,.]/g, ''))

                            data.realName = null
                            data.biography = null
                            data.webpage = null

                            data.isPrivate = false
                            if (document.querySelector(querySelectors.profilePrivate) !== null)
                                data.isPrivate = true

                            if (document.querySelector(querySelectors.profileRealName))
                                data.realName = document.querySelector(querySelectors.profileRealName).innerText
                            if (document.querySelector(querySelectors.profileBiography))
                                data.biography = document.querySelector(querySelectors.profileBiography).innerText
                            if (document.querySelector(querySelectors.profileWebpage))
                                data.webpage = document.querySelector(querySelectors.profileWebpage).innerText
                            
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
        
                            if (grabPosts)
                                next()
                            else
                                resolve(data)
                        } catch(e) {
                            console.log('Encountered an error!', e)
                            reject(e)
                        }
                    })
                }, config.querySelectors, previousPosts, grabPosts)
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

function doLogin(login, password) {
    return new Promise((resolve, reject) => {
        if (notBusy())
            if (isLoggedIn === login) {
                taskIsOver(resolve, false)
            } else {
                nightmare
                    .goto('https://www.instagram.com/accounts/login/')
                    .wait('input[type=text]')
                    .type('input[type=text]', login)
                    .type('input[type=password]', password + '\u000d')
                    .wait('.coreSpriteDesktopNavProfile')
                    .then(() => {
                        isLoggedIn = login
                        taskIsOver(resolve, true)
                    })
                    .catch(reject)
            }
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
            } else {
                console.log('Not signed in')
                taskIsOver(reject, err)
            }
        else
            reject('busy')
    })
}

function getCookies() {
    return new Promise((resolve, reject) => {
        if (notBusy()) {
            let sessionId, userId
            nightmare
                .cookies.get('sessionid')
                .then(c => {
                    sessionId = c
                    nightmare
                        .cookies.get('ds_user_id')
                        .then(c => {
                            userId = c
                            taskIsOver(resolve, { sessionId, userId })
                        })
                })
                .catch(err => taskIsOver(reject, err))
        } else {
            reject('busy')
        }
    })
}

function end() {
    return new Promise((resolve, reject) => {
        nightmare.end()
            .then(() => {
                isLoggedIn = false
                taskIsOver(resolve, true)
            })
            .catch(err => taskIsOver(reject, err))
    })
}

// getPostFromURL('https://www.instagram.com/p/Bh9TervgEo-/').then(data => console.log(data))
// getPostFromURL('https://www.instagram.com/p/Bf2Wl0uAy_f/').then(data => console.log(data))
// getProfile('https://www.instagram.com/joosseefkung/', ['BSUTF5rlPdc', '1A89EwAyZ0', 'xiZcGQgyba']).then(data => console.log(data))

// getProfile('fridahellstrom_', [], true).then(data => {
//     console.log(data)
// }).catch(err => console.log(err)) 

module.exports = {
    getCookies,
    getPost,
    getPostFromURL,
    getProfile,
    getProfileFromURL,
    getSavedPosts,
    doLogin,
    end,

    getIsLoggedIn,
    busy,
}