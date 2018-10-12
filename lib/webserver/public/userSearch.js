const input = document.getElementById('userSearch')
const options = document.getElementById('options')

var id

function callback() {
    let s = input.value
    fetch(`/api/user/search?username=${input.value}`).then(r => r.json()).then(json => {
        console.log(json)
        let html = ''
        if (json.result.length > 0) {
            json.result.forEach(v => {
                let i = v.username.indexOf(s)
                html += `<tr><td><a href="/user?username=${v.username}">${v.username.substring(0,i)}<u>${v.username.substring(i,i+s.length)}</u>${v.username.substring(i+s.length)}</a><td></tr>`
            })
        } else {
            html = `<tr>No user found, would you like to <a href="javascript:addUser('${json.username}')">add <i>${json.username}</i> as a new user</a>?</tr>`
        }
        options.innerHTML = html
    }).catch(err => console.log('Something went wrong with fetch:', err))
}

function preCallback() {
    clearTimeout(id)
    id = setTimeout(callback, 500)
}

function addUser(username) {
    input.setAttribute('disabled', true)
    fetch(`/api/user/add?username=${username}`).then(r => r.json()).then(json => {
        console.log('Added new user:', json)
        callback()
        input.removeAttribute('disabled')
    }).catch(console.log)
}

input.addEventListener('keypress', preCallback)
input.addEventListener('paste', preCallback)