const socketIo = require('socket.io')

const Database = require('./Database')
const EventEmitter = require('./EventEmitter')
const Robot = require('./Robot')

let io, clients = []

function init(httpServer) {
    io = socketIo(httpServer)

    io.on('connection', socket => {
        clients.push(socket)

        socket.on('disconnect', reason => {
            clients.splice(clients.indexOf(socket), 1)
        })
    
        socket.on('status', () => socket.emit('status', Robot.getStatus()))
        socket.on('paused', () => socket.emit('paused', Robot.getPaused()))
        socket.on('queue', () => 
            Database.query.all('SELECT * FROM queue ORDER BY priority DESC LIMIT 10')
                .then(items => socket.emit('queue', items))
                .catch(console.log))
        socket.on('queueCount', () =>
            Database.query.get('SELECT count(*) as c FROM queue')
                .then(row => socket.emit('queueCount', row.c))
                .catch(console.log))
    })
}

EventEmitter.on('robotSetStatus', newStatus => {
    io.emit('status', newStatus)
})

EventEmitter.on('robotSetPaused', newPaused => {
    io.emit('paused', newPaused)
})

EventEmitter.on('addedToQueue', () => {
    Database.query.all('SELECT * FROM queue ORDER BY priority DESC LIMIT 10')
        .then(items => io.emit('queue', items))
        .catch(console.log)
    Database.query.get('SELECT count(*) as c FROM queue')
        .then(row => io.emit('queueCount', row.c))
        .catch(console.log)
})

EventEmitter.on('removedFromQueue', () => {
    Database.query.all('SELECT * FROM queue ORDER BY priority DESC LIMIT 10')
        .then(items => io.emit('queue', items))
        .catch(console.log)
    Database.query.get('SELECT count(*) as c FROM queue')
        .then(row => io.emit('queueCount', row.c))
        .catch(console.log)
})

module.exports = {
    init
}