let socket = io()

socket.on('connect', () => {
    socket.emit('queue')
    socket.emit('queueCount')
})


socket.on('status', newStatus => {
    document.getElementById('status').innerText = newStatus
})

socket.on('paused', newPaused => {
    document.getElementById('paused').checked = newPaused
})

socket.on('storiesPaused', newPaused => {
    document.getElementById('storiesPaused').checked = newPaused
})

socket.on('queue', queue => {
    let rw = ''
    for (let i = 0; i < Math.min(queue.length, 10); i++) {
        let item = queue[i]
        rw += `<tr><td>${item.type}</td><td>${item.content}</td>`
        if (item.priority) rw += '<td>priority</td>'
        rw += '</tr>'
    }
    document.getElementById('queue').innerHTML = rw
})

socket.on('queueCount', count => {
    document.getElementById('queueCount').innerText = count
})

document.forms[0].addEventListener('submit', ev => {
    ev.preventDefault()
    queueType.disabled = true
    queueLogin.disabled = true
    queueContent.disabled = true
    queuePriority.disabled = true
    queueSubmit.disabled = true
    let type = queueType.value, loginId = queueLogin.value, content = queueContent.value, priority = queuePriority.checked === true ? 1 : 0
    fetch(`/api/queue/add?type=${type}&loginId=${loginId}&content=${content}&priority=${priority}`).then(r => r.json()).then(json => {
        console.log('Added to queue:', json)
        queueType.disabled = false
        queueLogin.disabled = false
        queueContent.disabled = false
        queuePriority.disabled = false
        queueSubmit.disabled = false
    }).catch(console.log)
})

const queueType     = document.getElementById('queueType'    )
const queueLogin    = document.getElementById('queueLogin'   )
const queueContent  = document.getElementById('queueContent' )
const queuePriority = document.getElementById('queuePriority')
const queueSubmit   = document.getElementById('queueSubmit'  )


document.getElementById('paused').addEventListener('change', ev => {
    ev.preventDefault()
    document.getElementById('paused').disabled = true
    let newVal = !document.getElementById('paused').checked
    let url = '/api/robot/pause'
    if (newVal) url = '/api/robot/unpause'
    fetch(url).then(r => r.json()).then(json => {
        console.log('Returned json:', json)
        document.getElementById('paused').checked = json.paused
        document.getElementById('paused').removeAttribute('disabled')
    }).catch(err => console.log('Something went wrong with fetch:', err))
})

document.getElementById('storiesPaused').addEventListener('change', ev => {
    ev.preventDefault()
    document.getElementById('storiesPaused').disabled = true
    let newVal = !document.getElementById('storiesPaused').checked
    let url = '/api/robot/storiesPause'
    if (newVal) url = '/api/robot/storiesUnpause'
    fetch(url).then(r => r.json()).then(json => {
        console.log('Returned json:', json)
        document.getElementById('storiesPaused').checked = json.storiesPaused
        document.getElementById('storiesPaused').removeAttribute('disabled')
    }).catch(err => console.log('Something went wrong with fetch:', err))
})