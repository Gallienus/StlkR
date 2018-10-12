const socketIo = require('socket.io')

const database = require('database')
const eventer = require('eventer')

let io, clients = []

function init(httpServer) {
    io = socketIo(httpServer)

    io.on('connection', socket => {
        clients.push(socket)

        socket.on('disconnect', reason => {
            clients.splice(clients.indexOf(socket), 1)
        })
    
        // TODO: reimplement robot
        // socket.on('status', () => socket.emit('status', Robot.getStatus()))
        // socket.on('paused', () => socket.emit('paused', Robot.getPaused()))
        socket.on('queue', () => 
            database.query.all('SELECT * FROM queue ORDER BY priority DESC LIMIT 10')
                .then(items => socket.emit('queue', items))
                .catch(console.log))
        socket.on('queueCount', () =>
            database.query.get('SELECT count(*) as c FROM queue')
                .then(row => socket.emit('queueCount', row.c))
                .catch(console.log))
    })
}

eventer.on('robotSetStatus', newStatus => {
    io.emit('status', newStatus)
})

eventer.on('robotSetPaused', newPaused => {
    io.emit('paused', newPaused)
})

eventer.on('addedToQueue', () => {
    database.query.all('SELECT * FROM queue ORDER BY priority DESC LIMIT 10')
        .then(items => io.emit('queue', items))
        .catch(console.log)
    database.query.get('SELECT count(*) as c FROM queue')
        .then(row => io.emit('queueCount', row.c))
        .catch(console.log)
})

eventer.on('removedFromQueue', () => {
    database.query.all('SELECT * FROM queue ORDER BY priority DESC LIMIT 10')
        .then(items => io.emit('queue', items))
        .catch(console.log)
    database.query.get('SELECT count(*) as c FROM queue')
        .then(row => io.emit('queueCount', row.c))
        .catch(console.log)
})

module.exports = {
    init
}