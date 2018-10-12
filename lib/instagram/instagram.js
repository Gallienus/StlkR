const fetch = require('node-fetch')

const config = require('../../config')

function login(username, password) {
    // POST /accounts/login/ajax
    // username=<username>&password=<password>&queryParams=%7B%7D
    // Set-Cookie: sessionid
    // Set-Cookie: ds_user_id

    console.log('Attempting login to', username)

    return new Promise((resolve, reject) => {
        initLogin().then(csrftoken => {
            let url = 'https://www.instagram.com/accounts/login/ajax/'
            let headers = {
                'X-Instagram-AJAX': 'e8608ab147a4',
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest',
                'User-Agent': config.userAgent,
                // 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
                'X-CSRFToken': csrftoken,
                'Cookie': `mid=Vom-xwAEAAGZ-fR60ixl6sE-ZFwJ; mcd=3; fbm_124024574287414=base_domain=.instagram.com; shbid=3492; shbts=1538254156.5070148; csrftoken=${csrftoken}; fbsr_124024574287414=N6Jb3_SBynyw_tx7_AweGPvzCkONw02RIKjFR7gyr3s.eyJhbGdvcml0aG0iOiJITUFDLVNIQTI1NiIsImNvZGUiOiJBUURuMnFNLWZzUmQwOHJ2YVdXVDRlMGNMYlhiS3NxZEY5UXhENnd2UFJZN2hWWnVXSDhGWHBVXzdRQnVLb1RpeHR2NVhtQ2FBSmM2dFNxUFNvOFFyMl9fVEhwaDdzeUpUVHhpWW5XUVQxUUJqTk9ZU1RackxwR25ael9BT3FUbkJYYjRvSHlsVDBDMm40Wm1IUU1tbXdlRUV3M0dtRGswRk5VcmFYVUV4TjNsY3E3TFBxelRvSlNJcm9GTmhoRjJhYi0zVGxzb2ZhSE1UczRkUzI5azRoa1o1Z0l3aHo0di0yc3dHUVd0bGZwazZRTGowandydTNiX3dVLUFLaWNObEIxc25VRkhPMjN4LUZuZ1N1aHJKZGwycmxwNXp6eDVwb3lIT2E4WXJab2NSWXBvZEg2SlVXT0twTGRKelBzNER6aTVuNldrQ0lsQWhiZTdJNlc1bHk4WlZwTjNzWWpkYjJBeDAzaHhiTlluM21PWDhPbW03bk12TFFFSmtsVV90aW8iLCJpc3N1ZWRfYXQiOjE1MzgzMTQ2NTgsInVzZXJfaWQiOiIxMDAwMDAzMzY4NDAxMTAifQ; rur=FRC; urlgen="{\"2001:2002:5ae0:ad0c:a498:8e39:eada:3642\": 3301}:1g6bus:RQqMS9XGXMnwRu49hDohqF_mNuo"`
                // 'Cookie': `mid=imademyownmidhahaniceone; mcd=3; fbm_124024574287414=base_domain=.instagram.com; shbid=3492; shbts=1538254156.5070148; csrftoken=${csrftoken}; rur=FRC;`
            }
            
            let sessionid
            fetch(url, { method:'POST', followAllRedirects:true, headers, body:`username=${username}&password=${password}&queryParams=%7B%7D` }).then(r => {
                let setCookie = r.headers.get('set-cookie')
                try {
                    sessionid = (/sessionid=(.*?);/).exec(setCookie)[1]
                    return r.json()
                } catch (e) {
                    r.text().then(text => {
                        if (text.indexOf('checkpoint_required') > -1) {
                            reject({ message:'login failed because of too many login attempts, wait 24 hours and try again' })
                        } else {
                            reject({ message:'bad credentials' })
                        }
                    }).catch(reject)
                }
            }).then(json => {
                if (json && json.authenticated === true){
                    if (json.userId) {
                        resolve({ sessionid, ds_user_id:json.userId })
                    } else {
                        reject({ message:'no user id in login response' })
                    }
                } else {
                    reject({ message:'failed to authenticate login', jsonResponse:json })
                }
            }).catch(reject)
        }).catch(reject)
    })
}

function initLogin() {
    // https://www.instagram.com/accounts/login/
    // Set-Cookie: csrftoken

    return new Promise((resolve, reject) => {
        fetch('https://www.instagram.com/accounts/login/', { headers: { 'User-Agent':config.userAgent } }).then(r => {
            let setCookie = r.headers.get('set-cookie')
            let csrftoken = (/csrftoken=(.*?);/).exec(setCookie)[1]
            resolve(csrftoken)
        }).catch(reject)
    })
}



function getUser(username, cookies) {
    return new Promise((resolve, reject) => {
        if (!isCookies(cookies)) return reject('no cookies')
        jsonFetch(`https://www.instagram.com/${username}/?__a=1`, cookies).then(json => {
            resolve(json.graphql.user)
        }).catch(reject)
    })
}

function getPost(code, cookies) {
    return new Promise((resolve, reject) => {
        if (!isCookies(cookies)) return reject('no cookies')
        jsonFetch(`https://www.instagram.com/p/${code}/?__a=1`, cookies).then(json => {
            resolve(json.graphql.shortcode_media)
        }).catch(reject)
    })
}

function getStories(username, cookies, userId=null) {
    return new Promise(async (resolve, reject) => {
        if (!isCookies(cookies)) return reject('no cookies')

        if (!userId)
            userId = (await (getUser(username, cookies))).id

        jsonFetch(`https://www.instagram.com/graphql/query/?query_hash=45246d3fe16ccc6577e0bd297a5db1ab&variables={%22reel_ids%22:[%22${userId}%22],%22tag_names%22:[],%22location_ids%22:[],%22highlight_reel_ids%22:[],%22precomposed_overlay%22:false}`, cookies).then(json => {
            if (json.data.reels_media.length > 0) {
                resolve(json.data.reels_media[0])
            } else {
                resolve(null)
            }
        }).catch(reject)
    })
}

function getUserPostsAll(username, cookies, stopAt=null, userId=null) {
    // stopAt is array of shortcodes for a post, if any of those codes are found the function stops

    return new Promise(async (resolve, reject) => {
        let posts = []

        if (!(stopAt instanceof Array))
            stopAt = [stopAt]
    
        if (!userId)
            userId = (await (getUser(username, cookies))).id
    
        let next = after => {
            getUserPosts(userId, cookies, after).then(json => {
                for (let node of json.edges) {
                    if (stopAt.indexOf(node.node.shortcode) > -1) {
                        return resolve(posts)
                    } else {
                        posts.push(node.node)
                    }
                }

                if (json.page_info.has_next_page) {
                    next(json.page_info.end_cursor)
                } else {
                    resolve(posts)
                }
            }).catch(reject)
        }

        next()
    })
}

function getUserPosts(userId, cookies, after=null, amount=24) {
    // https://www.instagram.com/graphql/query/?query_hash=5b0222df65d7f6659c9b82246780caa7&variables={"id":"<userId>","first":12,"after":"QVFDUUtsMW1hQmpzSEgxa2tXeHYxRnY2YmxiWklJZXR0UDAzY3RZbkhYWk56anV4dElrZU1mNldNNVpLbF84UUJSZlpwbHgwWC14YjNTdVFXU1VSN3Y5SQ=="}

    return new Promise((resolve, reject) => {
        let url = `https://www.instagram.com/graphql/query/?query_hash=5b0222df65d7f6659c9b82246780caa7&variables={"id":"${userId}","first":${amount}`
    
        if (after) url += `,"after":"${after}"}`
        else       url += '}'

        jsonFetch(url, cookies).then(json => {
            resolve(json.data.user.edge_owner_to_timeline_media)
        }).catch(reject)
    })
}

function getSavedPostsAll(cookies, stopAt=null) {
    // stopAt is shortcode for a post

    return new Promise(async (resolve, reject) => {
        let posts = []
    
        if (!isCookies(cookies))
            return reject('bad cookies')

        if (!(stopAt instanceof Array))
        stopAt = [stopAt]
    
        let next = after => {
            getSavedPosts(cookies, after).then(json => {
                for (let node of json.edges) {
                    if (stopAt.indexOf(node.node.shortcode) > -1) {
                        return resolve(posts)
                    } else {
                        posts.push(node.node)
                    }
                }

                if (json.page_info.has_next_page) {
                    next(json.page_info.end_cursor)
                } else {
                    resolve(posts)
                }
            }).catch(reject)
        }

        next()
    })
}

function getSavedPosts(cookies, after=null, amount=24) {
    // https://www.instagram.com/graphql/query/?query_hash=8c86fed24fa03a8a2eea2a70a80c7b6b&variables={"id":"<userId>","first":12,"after":"QVFENVVBWmtBMzBtN3oySkRGbTBLTi1vcDQ0RnN3amlObVVTYzUtU0liZGZqUmFVenAzbkpQWXZ0T2xzbW1uUTQ5eUVDX25iYm5pcVJTYmlXV0EtMHpwMA=="}

    return new Promise((resolve, reject) => {
        if (!isCookies(cookies))
            return reject('bad cookies')
        
        let userId = cookies.ds_user_id

        let url = `https://www.instagram.com/graphql/query/?query_hash=8c86fed24fa03a8a2eea2a70a80c7b6b&variables={"id":"${userId}","first":${amount}`
    
        if (after) url += `,"after":"${after}"}`
        else       url += '}'

        jsonFetch(url, cookies).then(json => {
            resolve(json.data.user.edge_saved_media)
        }).catch(reject)
    })
}



function isCookies(cookies) {
    return cookies
            && typeof cookies.sessionid === 'string'
            && typeof cookies.ds_user_id === 'string'
}

function cookiesToHeader(cookies) {
    if (!isCookies(cookies)) return null
    return `sessionid=${cookies.sessionid}; ds_user_id=${cookies.ds_user_id}`
}

function jsonFetch(url, cookies) {
    return new Promise((resolve, reject) => {
        let headers = { 'User-Agent': config.userAgent }
        if (isCookies(cookies)) {
            headers.Cookie = cookiesToHeader(cookies)
        }

        fetch(url, { headers })
                .then(r => r.json())
                .then(resolve)
                .catch(reject)
    })
}


module.exports = {
    login,
    getUser,
    getPost,
    getStories,
    getUserPostsAll,
    getUserPosts,
    getSavedPostsAll,
    getSavedPosts,
}