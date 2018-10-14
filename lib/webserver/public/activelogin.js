const elSelect = document.getElementById('selectLogin')

let activeLogin = localStorage.getItem('activeLogin')

if (activeLogin) {
    try {
        activeLogin = JSON.parse(activeLogin)
        elSelect.innerText = activeLogin.username
    } catch (e) {}
}

let busy = false
elSelect.addEventListener('click', () => {
    if (!busy) {
        busy = true
        fetch('/api/login/list').then(r => r.json()).then(json => {
            let popup = document.createElement('popup')
            popup.style.position = 'fixed'
            popup.style.top = '0'
            popup.style.left = '0'
            popup.style.textAlign = 'center'
            popup.style.backgroundColor = 'rgba(0,0,0,0.4)'
            popup.style.width = '100vw'
            popup.style.height = '100vh'
            popup.style.paddingTop = 'calc(50vh - 20px)'
            let select = document.createElement('select')
            let html = ''
            let logins = {}
            for (let login of json.logins) {
                html += `<option value="${login.id}">${login.username}</option>`
                logins[login.id] = login.username
            }
            select.innerHTML = html
            let btn = document.createElement('button')
            btn.innerText = 'Select'
            btn.addEventListener('click', () => {
                activeLogin = {login_id:select.value, username:logins[select.value]}
                localStorage.setItem('activeLogin', JSON.stringify(activeLogin))
                elSelect.innerText = activeLogin.username
                popup.remove()
                busy = false
            })
            let btnCancel = document.createElement('button')
            btnCancel.innerText = 'Cancel'
            btnCancel.addEventListener('click', () => {
                popup.remove()
                busy = false
            })
            popup.appendChild(select)
            popup.appendChild(btn)
            popup.appendChild(btnCancel)
            document.body.appendChild(popup)
        })
    }
})