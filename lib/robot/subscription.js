const database = require('database')
const queue = require('./queue')

let subscriptions = [], paused = false

function pause() {
    paused = true
}

function unpause() {
    if (paused) {
        paused = false
        run()
    }
}
function isPaused() {
    return paused
}

async function run() {
    if (paused) return

    let subsToRun = subscriptionsToRun()

    if (subsToRun.length > 0) {
        let items = [], dn = Date.now()
        for (let sub of subsToRun) {
            if (sub.profile === 1)
                items.push({ type:'profile', login_id:sub.login_id, content:sub.username })
            if (sub.story === 1)
                items.push({ type:'stories', login_id:sub.login_id, content:sub.username })
            if (sub.posts === 1)
                items.push({ type:'posts', login_id:sub.login_id, content:sub.username })
            
            await (database.update('subscription', { last_check:dn }, 'id', sub.id))
            sub.last_check = dn
        }
        await (queue.addToQueue.apply(queue.addToQueue, items))
    }

    setTimeout(run, nextTimeToRun())
}

function subscriptionsToRun() {
    return subscriptions
            .filter(sub => sub.last_check + sub.interval < Date.now())
}

function nextTimeToRun() {
    let dn = Date.now(), closest = dn + 60000
    if (subscriptions.length === 0)
        return closest
    subscriptions
            .filter(sub => dn < sub.last_check + sub.interval)
            .map(sub => {
        closest = Math.min(closest, sub.last_check + sub.interval)
    })
    return closest - dn
}

function updateSubscriptions() {
    return new Promise((resolve, reject) => {
        database.query.all(
            `SELECT
                subscription.*,
                user.username
            FROM subscription 
            LEFT JOIN user ON user.id = subscription.user_id
            WHERE login_id IN (SELECT id FROM login WHERE ds_user_id IS NOT NULL AND sessionid IS NOT NULL)`).then(subs => {
            subscriptions = subs
            if (!paused) run()
            resolve()
        }).catch(reject)
    })
}


function subscribe(loginId, userId, { profile, story, posts, interval }) {
    return new Promise(async (resolve, reject) => {
        let dbSubscription = await (database.query.get('SELECT * FROM subscription WHERE login_id = ? AND user_id = ?', loginId, userId))
        if (dbSubscription) {
            await (database.update('subscription', { profile, story, posts, interval }, 'id', dbSubscription.id))
        } else {
            interval = parseInt(interval)
            if (isNaN(interval))
                interval = undefined
            else if (interval < 0)
                interval = 84600000
            await (database.set('subscription', ['login_id', 'user_id', 'profile', 'story', 'posts', 'interval'], [loginId, userId, profile, story, posts, interval]))
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

    pause,
    unpause,
    isPaused,
}