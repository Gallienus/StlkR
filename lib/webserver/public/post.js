
const ageWhenPosted = document.getElementById('ageWhenPosted')
const ageNow = document.getElementById('ageNow')
const uploadedEl = document.getElementById('uploadedEl')

const addToQueueButton = document.getElementById('addToQueue')
const deleteContentsButton = document.getElementById('deleteContents')

const elLastCheck = document.getElementById('lastCheck')

const birthdayStart = document.getElementById('user_birthday_start').value
const birthdayStop = document.getElementById('user_birthday_stop').value
const uploaded = document.getElementById('uploaded').value
const code = document.getElementById('code').value
const lastCheck = document.getElementById('last_check').value

let n = parseInt(lastCheck)
if (!isNaN(n)) {
    n = Date.now() - n
    let w = 604800000, d = 86400000, h = 3600000, m = 60000, s = 1000
    if (n >= w) { // weeks
        let div = n/w
        if (div % 1 === 0) elLastCheck.innerText = `${div} weeks ago`
        else               elLastCheck.innerText = `~${Math.round(div)} weeks ago`
    } else if (n >= d) { // days
        let div = n/d
        if (div % 1 === 0) elLastCheck.innerText = `${div} days ago`
        else               elLastCheck.innerText = `~${Math.round(div)} days ago`
    } else if (n >= h) { // hours
        let div = n/h
        if (div % 1 === 0) elLastCheck.innerText = `${div} hours ago`
        else               elLastCheck.innerText = `~${Math.round(div)} hours ago`
    } else if (n >= m) { // minutes
        let div = n/m
        if (div % 1 === 0) elLastCheck.innerText = `${div} minutes ago`
        else               elLastCheck.innerText = `~${Math.round(div)} minutes ago`
    } else if (n >= s) { // seconds
        let div = n/s
        if (div % 1 === 0) elLastCheck.innerText = `${div} seconds ago`
        else               elLastCheck.innerText = `~${Math.round(div)} seconds ago`
    }  else { // milliseconds
        elLastCheck.innerText = `${n} milliseconds ago`
    }
}

addToQueueButton.addEventListener('click', () => {
    if (activeLogin) {
        addToQueueButton.setAttribute('disabled', true)
        fetch(`/api/queue/add?type=post&loginId=${activeLogin.login_id}&content=${code}`).then(r => r.json()).then(json => {
            console.log('Returned json:', json)
            addToQueueButton.style.backgroundColor = 'green'
        }).catch(console.log)
    } else {
        addToQueueButton.classList.add('negative')
    }
})

deleteContentsButton.addEventListener('click', () => {
    deleteContentsButton.setAttribute('disabled', true)
    fetch(`/api/post/deleteContent?code=${code}`).then(r => r.json()).then(json => {
        console.log('Returned json:', json)
        if (json.success) deleteContentsButton.classList.add('positive')
        else deleteContentsButton.classList.add('negative')
    }).catch(console.log)
})

function updateAgeNow(age) {
    if (age && age.start) {
        let low = Math.floor((Date.now() - age.start) / 31557600000)
        if (age.stop) {
            let high = Math.floor((Date.now() - age.stop) / 31557600000)
            if (low === high) {
                ageNow.innerText = `~${low} years old`
            } else {
                ageNow.innerText = `~${high}-${low} years old`
            }
        } else {
            ageNow.innerText = `${low} years old`
        }
    } else {
        ageNow.innerText = '-'
    }   
}

function updateAgeWhenPosted(age, upl) {
    if (age && age.start && upl) {
        let low = Math.floor((upl - age.start) / 31557600000)
        if (age.stop) {
            let high = Math.floor((upl - age.stop) / 31557600000)
            if (low === high) {
                ageWhenPosted.innerText = `~${low} years old`
            } else {
                ageWhenPosted.innerText = `~${high}-${low} years old`
            }
        } else {
            ageWhenPosted.innerText = `${low} years old`
        }
    } else {
        ageWhenPosted.innerText = '-'
    } 
}

if (uploaded) {
    let a = new Date()
    a.setTime(uploaded)
    let options = {
        year:'numeric',
        month:'2-digit',
        day:'2-digit',
        hour:'2-digit',
        minute:'2-digit',
        second:'2-digit'
    }
    uploadedEl.innerText = a.toLocaleString(undefined, options)
}

updateAgeNow({ start:birthdayStart, stop:birthdayStop })
updateAgeWhenPosted({ start:birthdayStart, stop:birthdayStop }, uploaded)
