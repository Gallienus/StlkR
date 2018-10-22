const fetch = require('node-fetch')

let vs = ''

let profiles = {}

function getCookies() {
    return new Promise((resolve, reject) => {
        fetch(`http://vsco.co/content/Static/userinfo?callback=jsonp_${Date.now()}_0`).then(r => {
            let setCookie = r.headers.get('set-cookie')
            try {
                vs = (/vs=(.*?);/).exec(setCookie)[1]
                console.log('vs:', vs)
            } catch(e) {
                console.log('cookie never set')
                reject(e)
            }
        }).catch(reject)
    })
}

function getSite(username) {
    return new Promise((resolve, reject) => {
        if (!username) return reject('no username')
        username = username.toLowerCase()
        fetch(`https://vsco.co/${username}`).then(r => r.text()).then(text => {
            let json
            try {
                json = /<script>window\.__PRELOADED_STATE__ = (.*?)<\/script>/g.exec(text)[1]
                json = JSON.parse(json)
                
                if (!profiles[username])
                    profiles[username] = {}

                profiles[username].json = json

                profiles[username].siteId = json.sites.siteByUsername[username].site.id
                profiles[username].profileImage = json.sites.siteByUsername[username].site.profileImage
                profiles[username].profileImageId = json.sites.siteByUsername[username].site.profileImageId

                // TODO: maybe we should do posts here...it will impact stopAt array for getSitePosts
                if (!profiles[username].posts)
                    profiles[username].posts = {}

                for (let imageId in json.entities.images)
                    profiles[username].posts[imageId] = json.entities.images[imageId]
                    
                resolve(profiles[username])
            } catch(e) {
                console.log('siteId not in response')
                reject(e)
            }
        })
    })
}

// TODO: make function with siteId instead
// TODO: remove profiles[<username>] cache
function getSitePosts(username, stopAt=[], mediaPerFetch=50) {
    return new Promise((resolve, reject) => {
        if (!username) return reject('no username')
        username = username.toLowerCase()
        if (profiles[username]) {
            if (!(stopAt instanceof Array))
                stopAt = [stopAt]

            if (!profiles[username].posts)
                profiles[username].posts = {}

            let siteId = profiles[username].siteId, posts = {}
            let doPage = page => {
                fetch(`https://vsco.co/api/2.0/medias?site_id=${siteId}&page=${page}&size=${mediaPerFetch}`, { headers: { cookie:`vs=${vs};` } }).then(r => r.json()).then(json => {
                    for (let media of json.media) {
                        if (stopAt.indexOf(media._id) > -1) {
                            return resolve(posts)
                        } else {
                            posts[media._id] = media
                            profiles[username].posts[media._id] = media
                        }
                    }

                    if (json.total > json.size) {
                        doPage(json.page + 1)
                    } else {
                        resolve(posts)
                    }
                }).catch(reject)
            }
            doPage(1)
        } else {
            reject('no user with username')
        }
    })
}

if (vs == null) {
    getCookies()
}

module.exports = {
    getCookies,
    getSite,
    getSitePosts,
}