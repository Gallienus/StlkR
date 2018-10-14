const path = require('path')
const Sqlite3 = require('sqlite3').verbose()

const { object2Arrays } = require('../Util')
const config = require('../../config')

const db = new Sqlite3.Database(config.paths.database)
console.log('Opened database at path:', config.paths.database)

require('./serialize')(db)


function addUser(username, data) {
    console.log('Adding user', username)
    let arys = object2Arrays(data)
    return set('user', ['username', ...arys.keys], [username, ...arys.values])
}

// uploader is type user object from database
function addPost(code, uploader, data) {
    console.log('Adding post', code, 'by', uploader.username)
    let arys = object2Arrays(data)
    return set('post', ['code', 'user_id', ...arys.keys], [code, uploader.id, ...arys.values])
}

// post is type post object from database
function addPostContent(post, data) {
    console.log('Adding content from post', post.code, 'by uid', post.user_id)
    let arys = object2Arrays(data)
    return set('content', ['post_id', ...arys.keys], [post.id, ...arys.values])
}

const addToQueue = (type, content) => set('queue', ['type', 'content'], [type, content])
const addSaved   = (...codes)      => set.apply(set, ['saved', ['code'], ...codes.map(c => [c])])

const getUser        = (username)  => get('user',    'username', username)
const getUserById    = (userId)    => get('user',    'id',       userId)
const getPostById    = (postId)    => get('post',    'id',       postId)
const getPostByCode  = (code)      => get('post',    'code',     code)
const getContentById = (contentId) => get('content', 'id',       contentId)

const getContentsByPost = post => getAll('content', 'post_id', post.id)
const getPostsByUser = (user, limitStart=0, limitSize=25) => getScope('post', 'user_id', user.id, limitStart, limitSize)
const getSaved       = () => getAll('saved', '1', 1, 'code')

const isUser = (username) => exists('user', 'username', username)
const isUserById = (userId) => exists('user', 'id', userId)
const isPostById = (postId) => exists('post', 'id', postId)
const isPostByCode = (code) => exists('post', 'code', code)
const isProfilePic = (url) => exists('profile_pic', 'url', url)

const deleteQueue = (queueId) => delet('queue', 'id', queueId)

function getContentsByUser(user) {
    return new Promise((resolve, reject) => {
        db.prepare('SELECT * FROM content WHERE post_id IN (SELECT id FROM post WHERE user_id = ?)').all(user.id, (err, contents) => {
            if (err) reject(err);
            else     resolve(contents)
        })
    })
}

function getProfilePictures(username) {
    return new Promise((resolve, reject) => {
        getUser(username).then(user => {
            if (!user) return reject('no user')
            db.prepare(`SELECT * FROM user_profile_picture WHERE user_id = ? AND filename IS NOT NULL ORDER BY last_seen DESC`).all(user.id, (err, pics) => {
                if (err) reject(err)
                else resolve(pics)
            })
        }).catch(reject)
    })
}

function getUserFull(username, what='user.username') {
    return new Promise((resolve, reject) => {
        let stmt = db.prepare(
            `SELECT
                user.*,
                (SELECT user_real_name.value FROM user_real_name WHERE user_real_name.user_id = user.id LIMIT 1) as real_name,
                (SELECT count(user_real_name.value) FROM user_real_name WHERE user_real_name.user_id = user.id) as real_name_count,
                (SELECT user_profile_picture.filename FROM user_profile_picture WHERE user_profile_picture.user_id = user.id AND user_profile_picture.filename IS NOT NULL ORDER BY user_profile_picture.last_seen DESC LIMIT 1) as profile_picture,
                (SELECT count(user_profile_picture.filename) FROM user_profile_picture WHERE user_profile_picture.user_id = user.id) as profile_picture_count,
                (SELECT user_biography.value FROM user_biography WHERE user_biography.user_id = user.id LIMIT 1) as biography,
                (SELECT count(user_biography.value) FROM user_biography WHERE user_biography.user_id = user.id) as biography_count,
                (SELECT user_web_page.value FROM user_web_page WHERE user_web_page.user_id = user.id LIMIT 1) as web_page,
                (SELECT count(user_web_page.value) FROM user_web_page WHERE user_web_page.user_id = user.id) as web_page_count,
                (SELECT count(post.id) FROM post WHERE post.user_id = user.id) as posts_in_db,
                (SELECT count(story.id) FROM story WHERE story.user_id = user.id) as stories_in_db,
                GROUP_CONCAT((SELECT user_tag.value FROM user_tag WHERE user_tag.user_id = user.id)) as tags,
                GROUP_CONCAT((SELECT user_other.value FROM user_other WHERE user_other.user_id = user.id)) as others,
                user_age.birthday_start,
                user_age.birthday_stop
            FROM user
            LEFT JOIN user_age ON user_age.user_id = user.id
            WHERE ${what} = ?`)
        stmt.get(username, (err, user) => {
            if (err) reject(err)
            else if (user.id === null) resolve(null)
            else resolve(user)
        })
    })
}

function getFullPostByCode(code) {
    return new Promise((resolve, reject) => {
        let stmt = db.prepare(
            `SELECT
                post.*,
                user.username as uploader,
                user_age.birthday_start as user_birthday_start,
                user_age.birthday_stop as user_birthday_stop,
                (SELECT count(*) FROM content WHERE content.stored_locally = 1 AND content.post_id = post.id) as contents_in_db
            FROM post
            LEFT JOIN user ON user.id = post.user_id
            LEFT JOIN user_age ON user_age.user_id = user.id
            WHERE code = ?`)
        stmt.get(code, (err, post) => {
            if (err) reject(err)
            else     resolve(post)
        })
    })
}

function getStats() {
    return new Promise((resolve, reject) => {
        let stmt = db.prepare(
            `SELECT
            (SELECT count(*) FROM user) as user_count,
            (SELECT count(*) FROM user_tag WHERE value = "hidden") as hidden_user_count,
            (SELECT count(*) FROM user_profile_picture) as user_profile_picture_count,
            (SELECT count(*) FROM user_biography) as user_biography_count,
            (SELECT count(*) FROM user_real_name) as user_real_name_count,
            (SELECT count(*) FROM user_web_page) as user_web_page_count,
            (SELECT count(*) FROM post) as post_count,
            (SELECT count(*) FROM post_tag WHERE value = "hidden") as hidden_post_count,
            (SELECT count(*) FROM content) as content_count,
            (SELECT count(*) FROM story) as story_count,
            (SELECT count(*) FROM login) as login_count,
            (SELECT count(*) FROM login WHERE ds_user_id IS NOT NULL AND sessionid IS NOT NULL) as logged_in_login_count,
            (SELECT count(*) FROM saved) as saved_count,
            (SELECT group_concat(saved, ', ') as saved FROM (SELECT (login.username || ':' || count(saved.id)) as saved FROM saved INNER JOIN login ON login.id = saved.login_id GROUP BY login.username)) as saved`)
        stmt.get((err, stats) => {
            if (err) reject(err)
            else     resolve(stats)
        })
    })
}

function getUndownloadedSaved() {
    return new Promise((resolve, reject) => {
        db.prepare('SELECT count(*) AS count FROM saved WHERE code NOT IN (SELECT code FROM post)').get((err, row) => {
            if (err) reject(err)
            else     resolve(row.count)
        })
    })
    
}

function updateUsers(users) {
    return new Promise((resolve, reject) => {
        if (!(users instanceof Array))
            users = [users]
        let indx = 0
        let next = () => {
            let user = users[indx]
            if (user === undefined) {
                resolve(true)
                return
            }
            update('user', user, 'id', user.id)
                .then(() => next(indx++))
                .catch(err => reject({ currentUser:user, error:err }))
        }
        next()
    })
}

function updateUserTags(userId, tags) {
    return new Promise((resolve, reject) => {
        if (!(tags instanceof Array))
            tags = [tags]
        delet('user_tag', 'user_id', userId)
            .then(() => {
                let vals = []
                tags.forEach(t => {
                    if (t.length > 0)
                        vals.push([userId, t])
                })
                if (vals.length > 0) {
                    let args = ['user_tag', ['user_id', 'tag'], ...vals]
                    set.apply(set, args)
                        .then(() => resolve(true))
                        .catch(err => reject(err))
                } else
                    resolve(true)
            })
            .catch(err => reject(err))
    })
}

function exists(table, variable, value) {
    console.log('Exists in table', table)
    return new Promise((resolve, reject) => {
        let stmt = db.prepare(`select 1 from ${table} where ${variable} = ?`)
        stmt.get(value, (err, row) => {
            if (err) reject(err)
            else
                if (row) resolve(true)
                else     resolve(false)
        })
    })
}

function get(table, variable, value, select='*') {
    console.log('Get from table', table)
    return new Promise((resolve, reject) => {
        let stmt = db.prepare(`SELECT ${select} FROM ${table} WHERE ${variable} = ?`)
        stmt.get(value, (err, row) => {
            if (err) reject(err)
            else     resolve(row)
        })
    })
}

function getScope(table, variable, value, limitStart=0, limitSize=25, select='*', orderBy='id', order='ASC') {
    console.log('Get scope from table', table)
    return new Promise((resolve, reject) => {
        let stmt = db.prepare(`SELECT ${select} FROM ${table} WHERE ${variable} = ? ORDER BY ${orderBy} ${order} LIMIT ?, ?`)
        stmt.all(value, limitStart, limitSize, (err, rows) => {
            if (err) reject(err)
            else     resolve(rows)
        })
    })
}

function getAll(table, whereVariable, whereValue, select='*', orderBy='id', order='ASC') {
    console.log('Get all from table', table)
    return new Promise((resolve, reject) => {
        let stmt = db.prepare(`SELECT ${select} FROM ${table} WHERE ${whereVariable} = ? ORDER BY ${orderBy} ${order}`)
        stmt.all(whereValue, (err, rows) => {
            if (err) reject(err)
            else     resolve(rows)
        })
    })
}

function set(table, variables, ...values) {
    console.log('Set to table', table)
    return new Promise((resolve, reject) => {
        let allValues = []
        let rawValues = ''
        values.forEach(subValues => {
            allValues = allValues.concat(subValues.map(val => {
                if (val === undefined) return null
                else                   return val
            }))
            rawValues += `(${'?,'.repeat(subValues.length).slice(0,-1)}),`
        })
        rawValues = rawValues.slice(0,-1)
        let raw = `INSERT OR REPLACE INTO ${table} (${variables.join(',')}) VALUES ${rawValues}`
        db.prepare(raw).run(allValues, err => {
            if (err) reject(err)
            else     resolve(true)
        })
    })
}

function setIgnore(table, variables, ...values) {
    console.log('Set to table', table)
    return new Promise((resolve, reject) => {
        let allValues = []
        let rawValues = ''
        values.forEach(subValues => {
            allValues = allValues.concat(subValues.map(val => {
                if (val === undefined) return null
                else                   return val
            }))
            rawValues += `(${'?,'.repeat(subValues.length).slice(0,-1)}),`
        })
        rawValues = rawValues.slice(0,-1)
        let raw = `INSERT OR IGNORE INTO ${table} (${variables.join(',')}) VALUES ${rawValues}`
        db.prepare(raw).run(allValues, err => {
            if (err) reject(err)
            else     resolve(true)
        })
    })
}

function update(table, object, whereVariable=1, whereValue=1) {
    console.log('Update in table', table)
    return new Promise((resolve, reject) => {
        let raw = ''
        let values = []
        for (let key in object) {
            raw += `${key}=?,`
            let val = object[key]
            if      (val === true  || val === 'true' ) val = 1
            else if (val === false || val === 'false') val = 0
            values.push(val)
        }
        raw = raw.slice(0,-1)

        let stmt = db.prepare(`UPDATE ${table} SET ${raw} WHERE ${whereVariable} = ?`)
        stmt.run([...values, whereValue], err => {
            if (err) reject(err)
            else     resolve(object)
        })
    })
}

function delet(table, variable, value) {
    console.log('Delete from table', table)
    return new Promise((resolve, reject) => {
        let stmt = db.prepare(`DELETE FROM ${table} WHERE ${variable} = ?`)
        stmt.run(value, err => {
            if (err) reject(err)
            else     resolve()
        })
    })
}

// auto-increment index for table name from database
// will be id for last inserted entry
function getAutoIncrementIndex(tableName) {
    return new Promise((resolve, reject) => {
        let stmt = db.prepare('SELECT seq FROM sqlite_sequence WHERE name=?')
        stmt.each(tableName, (err, row) => {
            if (err) reject(err)
            else     resolve(row.seq)
        })
    })
}

module.exports = {
    addPost,
    addPostContent,
    addSaved,
    addToQueue,
    addUser,
    getUserFull,
    getContentById,
    getContentsByPost,
    getContentsByUser,
    getFullPostByCode,
    getUndownloadedSaved,
    getUser,
    getUserById,
    getPostByCode,
    getPostById,
    getPostsByUser,
    getProfilePictures,
    getSaved,
    getStats,
    deleteQueue,
    isPostByCode,
    isPostById,
    isProfilePic,
    isUser,
    isUserById,
    updateUsers,
    updateUserTags,

    exists,
    delet,
    get,
    getAutoIncrementIndex,
    getAll,
    getScope,
    update,
    set,
    setIgnore,

    db,

    query: {
        all: (query, ...vals) => {
            return new Promise((resolve, reject) => {
                db.prepare(query).all(vals, (err, rows) => {
                    if (err) reject(err)
                    else     resolve(rows)
                })
            })
        },
        get: (query, ...vals) => {
            return new Promise((resolve, reject) => {
                db.prepare(query).get(vals, (err, row) => {
                    if (err) reject(err)
                    else     resolve(row)
                })
            })
        },
        run: (query, ...vals) => {
            return new Promise((resolve, reject) => {
                db.prepare(query).run(vals, (err) => {
                    if (err) reject(err)
                    else     resolve()
                })
            })
        }
    }
}