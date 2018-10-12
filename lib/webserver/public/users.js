const previewWidget = document.querySelector('#previewWidget > div')

let cache = {}, mouseX = 0, mouseY = 0

document.addEventListener('mouseover', ev => {
    if (ev.target.classList.contains('usernameElement')) {
        previewWidget.hidden = false
        previewWidget.innerHTML = 'Loading...'
        let username = ev.target.innerText
        if (!username || !username.length) return
        if (cache[username]) {
            setPreview(cache[username])
        } else {
            fetch(`/api/user/profilePic?username=${username}`).then(r => r.json()).then(json => {
                console.log('Returned json:', json)
                cache[username] = json.filename || null
                setPreview(json.filename)
            })
        }
    } else {
        if (!previewWidget.hidden)
            previewWidget.hidden = true
    }
})

function setPreview(filename) {
    if (filename) {
        previewWidget.innerHTML = `<img src='/storage/${filename}'>`
    } else {
        previewWidget.innerHTML = 'No profile picture found!'
    }
    updateWidgetPos()
    previewWidget.hidden = false
}

function updateWidgetPos() {
    previewWidget.style.top = Math.min(mouseY + 5, window.innerHeight - previewWidget.clientHeight - 25) + 'px'
    previewWidget.style.left = (mouseX + 10) + 'px'
}

document.addEventListener('mousemove', ev => {
    mouseX = ev.clientX
    mouseY = ev.clientY
    updateWidgetPos()
})