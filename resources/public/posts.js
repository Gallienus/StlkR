const previewWidget = document.querySelector('#previewWidget > div')

let cache = {}, mouseX = 0, mouseY = 0

document.addEventListener('mouseover', ev => {
    if (ev.target.classList.contains('codeElement')) {
        previewWidget.hidden = false
        previewWidget.innerHTML = 'Loading...'
        let code = ev.target.innerText
        if (!code || !code.length) return
        if (cache[code]) {
            let store = cache[ev.target.innerText]
            if (store.hasImages) {
                setPreview(store.contents)
            } else {
                previewWidget.hidden = false
                previewWidget.innerHTML = 'No images'
            }
        } else {
            fetch(`/api/post/contents?code=${code}`).then(r => r.json()).then(json => {
                console.log('Returned json:', json)
                if (json.success) {
                    cache[code] = { hasImages:true, contents:json.contents }
                    setPreview(json.contents)
                } else {
                    cache[code] = { hasImages:false }
                    previewWidget.hidden = false
                    previewWidget.innerHTML = 'No images'
                }
            }).catch(console.log)
        }
    } else {
        if (!previewWidget.hidden)
            previewWidget.hidden = true
    }
})

function setPreview(contents) {
    let html = ''
    contents.forEach(content => {
        if (content.stored_locally) {
            if (content.is_video) {
                html += `<img src='/storage/${content.preview_filename}'>`
            } else {
                html += `<img src='/storage/${content.media_filename}'>`
            }
        } else {
            html += 'Image(s) are not locally stored!'
        }
    })
    previewWidget.innerHTML = html
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