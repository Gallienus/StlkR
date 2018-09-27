// jshint esversion: 6

const path = require('path')
const Sqlite3 = require('sqlite3').verbose()
const { object2Arrays } = require('./Util')

const config = require('../config')

const dbPath = path.join(__dirname, '..', config.database.relativePath)
const db = new Sqlite3.Database(dbPath)
console.log('Opened database at path:', dbPath)

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS "user" (
        id                   INTEGER PRIMARY KEY,
        username             TEXT UNIQUE NOT NULL,
        real_name            TEXT,
        biography            TEXT,
        webpage              TEXT,
        is_private           BOOLEAN,
        other_data           TEXT,
        post_count           INTEGER,
        followers_count      INTEGER,
        following_count      INTEGER,
        still_exists         BOOLEAN DEFAULT 1,
        download_all_posts   BOOLEAN DEFAULT 0,
        instagram_id         INTEGER
    )`)
    // json            TEXT

    db.run(`CREATE TABLE IF NOT EXISTS "post" (
        id                INTEGER PRIMARY KEY,
        code              TEXT UNIQUE NOT NULL,
        user_id           INTEGER NOT NULL,
        uploaded          INTEGER,
        comment_count     INTEGER,
        like_count        INTEGER,
        caption           TEXT,
        still_exists      BOOLEAN,
        other_data        TEXT,
        saved_content     BOOLEAN DEFAULT 0
    )`)
    // display_src       TEXT NOT NULL,
    // is_video          BOOLEAN DEFAULT false,
    // video_url         TEXT,

    db.run(`CREATE TABLE IF NOT EXISTS "content" (
        id               INTEGER PRIMARY KEY,
        post_id          INTEGER NOT NULL,
        user_id          INTEGER,
        is_video         BOOLEAN DEFAULT 0,
        media_url        TEXT,
        preview_url      TEXT,
        image_hash       TEXT,
        stored_locally   BOOLEAN DEFAULT 0,
        media_filename   TEXT,
        preview_filename TEXT,
        view_count       INTEGER
    )`)

    // profile, post, content
    db.run(`CREATE TABLE IF NOT EXISTS "queue" (
        id       INTEGER PRIMARY KEY,
        type     TEXT NOT NULL,
        content  TEXT UNIQUE NOT NUlL,
        priority BOOLEAN DEFAULT 0
    )`)

    db.run(`CREATE TABLE IF NOT EXISTS "saved" (
        id   INTEGER PRIMARY KEY,
        code TEXT UNIQUE NOT NULL
    )`)

    db.run(`CREATE TABLE IF NOT EXISTS "age" (
        user_id  INTEGER PRIMARY KEY,
        birthday_start INTEGER NOT NULL,
        birthday_stop  INTEGER
    )`)
    
    db.run(`CREATE TABLE IF NOT EXISTS "user_tag" (
        id      INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        tag     TEXT NOT NULL
    )`)

    db.run(`CREATE TABLE IF NOT EXISTS "profile_pic" (
        id       INTEGER PRIMARY KEY,
        user_id  INTEGER,
        url      TEXT,
        filename TEXT
    )`)

    db.run(`CREATE TABLE IF NOT EXISTS "cookie" (
        id         INTEGER PRIMARY KEY,
        session_id TEXT NOT NULL,
        ds_user_id TEXT NOT NULL,
        login      TEXT
    )`)

    db.run(`CREATE TABLE IF NOT EXISTS "story" (
        id               INTEGER PRIMARY KEY,
        user_id          INTEGER NOT NULL,
        uploaded         INTEGER,
        is_video         BOOLEAN DEFAULT 0,
        preview_url      TEXT,
        media_url        TEXT,
        preview_filename TEXT UNIQUE,
        media_filename   TEXT UNIQUE
    )`)

    db.run(`CREATE TABLE IF NOT EXISTS "user_relation" (
        id           INTEGER PRIMARY KEY,
        from_user_id INTEGER NOT NULL,
        to_user_id   INTEGER NOT NULL,
        relation     TEXT NOT NULL,
        mutual       BOOLEAN DEFAULT 0
    )`)

    db.run(`CREATE TABLE IF NOT EXISTS "story_subscription" (
        user_id    INTEGER PRIMARY KEY,
        interval   INTEGER DEFAULT 84600000,
        last_check INTEGER DEFAULT 0
    )`)
})


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

function getProfilePics(username) {
    return new Promise((resolve, reject) => {
        getUser(username).then(user => {
            if (!user) return reject('no user')
            getAll('profile_pic', 'user_id', user.id).then(profilePics => {
                resolve(profilePics)
            }).catch(reject)
        }).catch(reject)
    })
}

function getFullUser(username, what='username') {
    return new Promise((resolve, reject) => {
        let stmt = db.prepare(
            `SELECT
             user.*,
             age.birthday_start,
             age.birthday_stop,
             story_subscription.interval as story_sub_interval,
             (SELECT COUNT(*) FROM profile_pic WHERE profile_pic.user_id = user.id) as profile_pics_in_db,
             (SELECT COUNT(*) FROM story WHERE story.user_id = user.id) as stories_in_db,
             (SELECT COUNT(*) FROM post WHERE post.user_id = user.id AND post.saved_content = 1) as posts_in_db,
             (SELECT COUNT(*) FROM content WHERE stored_locally = 1 AND content.user_id = user.id) as contents_in_db,
             GROUP_CONCAT(user_tag.tag) as tags,
             profile_pic.url as profile_pic_url,
             profile_pic.filename as profile_pic_filename
             FROM user
             LEFT JOIN age ON age.user_id = user.id
             LEFT JOIN user_tag ON user_tag.user_id = user.id
             LEFT JOIN story_subscription ON story_subscription.user_id = user.id
             LEFT JOIN (SELECT * FROM profile_pic) AS profile_pic ON profile_pic.user_id = user.id
             WHERE ${what} = ?
             GROUP BY profile_pic.filename
             ORDER BY profile_pic.id DESC
             LIMIT 1`)
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
             *,
             age.birthday_start as user_birthday_start,
             age.birthday_stop as user_birthday_stop,
             (SELECT username FROM user WHERE user.id = post.user_id) as uploader,
             (SELECT count(*) FROM content WHERE stored_locally = 1 AND content.post_id = post.id) as contents_in_db
             FROM post
             LEFT JOIN age ON age.user_id = post.user_id
             WHERE code = ?`)
        stmt.get(code, (err, post) => {
            if (err) reject(err)
            else     resolve(post)
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
    getContentById,
    getContentsByPost,
    getContentsByUser,
    getFullPostByCode,
    getFullUser,
    getUndownloadedSaved,
    getUser,
    getUserById,
    getPostByCode,
    getPostById,
    getPostsByUser,
    getProfilePics,
    getSaved,
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