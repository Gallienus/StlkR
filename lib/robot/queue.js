const eventer = require('eventer')
const database = require('database')

/*
queue types:
    profile (fetch profile information, and all post codes IF download_all_posts IS TRUE) - content=username
    post    (fetch post information and download all content for post)                    - content=post code

    downloadSaved (fetch all NEW posts from login's saved posts list)           - content=login
    saved2Queue (put all saved posts in the database in the queue for fetching) - content=login?
    content2DownloadQueue (put not saved content in download queue)             - content=???
    downloadContent (download content media/preview)                            - content=content id

    login (login to a user) - content="username:password"
*/

// addToQueue({type:'profile',login_id:31,content:'jo...'},{type:'post',content:'AsGaDbB...'})
function addToQueue(item1, ...itemN) {
    return new Promise((resolve, reject) => {
        if (!item1) return reject('no items')
        let items = []
        let itemObjectList = [item1]
        if (itemN)
            itemObjectList = itemObjectList.concat(itemN)
        itemObjectList.forEach(item => items.push([item.login_id, item.type, item.content, item.priority ? 1 : 0]))
        database.set.apply(database.set, ['queue', ['login_id', 'type', 'content', 'priority'], ...items])
            .then(() => {
                resolve()
                eventer.emit('addedToQueue', itemObjectList)
            })
            .catch(reject)
    })
}

function removeFromQueue(queueId) {
    return new Promise((resolve, reject) => {
        database.deleteQueue(queueId)
            .then(() => {
                resolve()
                eventer.emit('removedFromQueue', queueId)
            }).catch(reject)
    })
}

function getFirstItemNotIn(itemIds) {
    if (!(itemIds instanceof Array))
        throw 'illegal argument'
    let values = itemIds.map(id => {
        let nId = parseInt(id)
        if (isNaN(nId))
            throw 'illegal argument item'
        return `(${nId})`
    }).join(',') || ''
    if (values.length > 0)
        return database.query.get(`SELECT * FROM queue WHERE id NOT IN (VALUES ${values}) ORDER BY priority DESC LIMIT 1`)
    else
        return getFirstItem()
}

function getNthItem(n) {
    if (typeof n !== 'number')
        throw 'illegal argument'
    return database.query.get(`SELECT * FROM queue ORDER BY priority DESC LIMIT 1 OFFSET ${n}`)
}

function getFirstItem() {
    return database.query.get('SELECT * FROM queue ORDER BY priority DESC')
}

function itemsCount() {
    return database.query.get('SELECT count(*) FROM queue')
}


module.exports = {
    addToQueue,
    getFirstItem,
    getFirstItemNotIn,
    getNthItem,
    itemsCount,
    removeFromQueue,
}