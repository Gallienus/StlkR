const EventEmitter = require('./EventEmitter')

const Database = require('./Database')

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

// addToQueue({type:'profile',content:'joos...'},{type:'post',content:'AsGaDbB...'})
function addToQueue(item1, ...itemN) {
    return new Promise((resolve, reject) => {
        if (!item1) return reject('no items')
        let items = []
        let itemObjectList = [item1]
        if (itemN)
            itemObjectList = itemObjectList.concat(itemN)
        itemObjectList.forEach(item => items.push([item.type, item.content, item.priority || false]))
        Database.set.apply(Database.set, ['queue', ['type', 'content', 'priority'], ...items])
            .then(() => {
                resolve()
                EventEmitter.emit('addedToQueue', itemObjectList)
            })
            .catch(reject)
    })
}

function removeFromQueue(queueId) {
    return new Promise((resolve, reject) => {
        Database.deleteQueue(queueId)
            .then(() => {
                resolve()
                EventEmitter.emit('removedFromQueue', queueId)
            }).catch(reject)
    })
}

function getFirstItem() {
    return Database.query.get('SELECT * FROM queue ORDER BY priority DESC')
}

function itemsCount() {
    return Database.query.get('SELECT count(*) FROM queue')
}


module.exports = {
    addToQueue,
    getFirstItem,
    itemsCount,
    removeFromQueue,
}