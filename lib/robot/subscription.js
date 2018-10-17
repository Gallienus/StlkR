

const database = require('database')

let subscriptions

function updateSubscriptions() {
    return new Promise((resolve, reject) => {
        database.query.all('SELECT * FROM subscription WHERE login_id IN (SELECT id FROM login WHERE ds_user_id IS NOT NULL AND sessionid IS NOT NULL)').then(subs => {
            subscriptions = subs
            resolve()
        }).catch(reject)
    })
}


function subscribe(loginId, userId, { profile=0, story=0, posts=0 }) {
    return new Promise(async (resolve, reject) => {
        let dbSubscription = await (database.query.get('SELECT * FROM subscription WHERE login_id = ? AND user_id = ?', loginId, userId))
        if (dbSubscription) {
            await (database.query.run('UPDATE subscription SET profile=?, story=?, posts=? WHERE login_id = ? AND user_id = ?', profile, story, posts, loginId, userId))
        } else {
            await (database.query.run('INSERT INTO subscription (login_id, user_id, profile, story, posts) VALUES (?, ?, ?, ?, ?)', loginId, userId, profile, stop, posts))
        }
        await updateSubscriptions()
        resolve()
    })
}

function unsubscribe(loginId, userId) {
    return new Promise(async (resolve, reject) => {
        await (database.query.run('DELETE FROM subscription WHERE login_id = ? AND user_id = ?', loginId, userId))
        resolve()
    })
}


updateSubscriptions().then().catch(console.log)

module.exports = {
    subscribe,
    unsubscribe,
    updateSubscriptions,
}