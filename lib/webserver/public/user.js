const el = id => document.getElementById(id)

const elFetchSub    = el('fetchSubscribed')
const elSubData     = el('subscriptionData')
const elSubBtn      = el('subscribe')
const elUnsubBtn    = el('unsubscribe')
const elSubStory    = el('subscribedStory')
const elSubPosts    = el('subscribedPosts')
const elSubProfile  = el('subscribedProfile')
const elSubInterval = el('subscribedInterval')

const cSubscribedBy = el('subscribed_by').value

let isSubscribed = false
for (let login of cSubscribedBy.split(',')) {
    if (login == activeLogin.username) {
        console.log('Subscribed by active login!')
        isSubscribed = true
    }
}

elFetchSub.addEventListener('click', () => {
    if (activeLogin) {
        elSubProfile.disabled = true
        elSubStory.disabled = true
        elSubPosts.disabled = true
        elSubInterval.disabled = true
        elSubData.disabled = true
        elUnsubBtn.disabled = true

        fetch(`/api/user/subscription?userId=${userId}&loginId=${activeLogin.login_id}`).then(r => r.json()).then(json => {
            console.log('Got json:', json)
            if (json.success) {
                elSubData.style.display = ''
                elFetchSub.style.display = 'none'
                elSubData.disabled = true
                
                elSubProfile.disabled = false
                elSubStory.disabled = false
                elSubPosts.disabled = false
                elSubInterval.disabled = false

                if (json.subscription) {
                    elSubProfile.checked = json.subscription.profile === 1
                    elSubStory.checked = json.subscription.story === 1
                    elSubPosts.checked = json.subscription.posts === 1
                    elSubInterval.value = json.subscription.interval
                    
                    elUnsubBtn.disabled = false
                } else {
                    elSubData.disabled = false
                    elUnsubBtn.disabled = true
                }
            }
        }).catch(console.log)
    } else {
        console.log('No active login')
    }
})

elSubBtn.addEventListener('click', () => {
    if (activeLogin) {
        fetch(`/api/user/subscription/update?userId=${userId}&login_id=${activeLogin.login_id}&profile=${elSubProfile.value}&story=${elSubStory.value}&posts=${elSubPosts.value}&interval=${elSubInterval.value}`).then(r => r.json()).then(json => {
            console.log('Got json:', json)
            if (json.success) {
                console.log('YAY!')
            }
        }).catch(console.log)
    } else {
        console.log('No active login')
    }
})

elUnsubBtn.addEventListener('click', () => {
    if (activeLogin) {
        fetch(`/api/user/subscription/update?userId=${userId}&loginId=${activeLogin.login_id}`)
    } else {
        console.log('No active login')
    }
})



const tagsInput  = document.getElementById('tags')
const tagsButton = document.getElementById('updateTags')

const usernameInput = document.getElementById('usernameInput')
const usernameButton = document.getElementById('updateUsername')

const ageInput1 = document.getElementById('birthdayStart')
const ageInput2 = document.getElementById('birthdayStop')
const ageButton = document.getElementById('updateAge')
const insertBirthYear = document.getElementById('insertBirthYear')
const insertAge = document.getElementById('insertAge')
const ageElement = document.getElementById('age')

const addToQueueButton = document.getElementById('addToQueue')
const addPostsToQueueButton = document.getElementById('addPostsToQueue')
const downloadStoryButton = document.getElementById('downloadStory')

const otherData = document.getElementById('otherData')

const elLastCheck = document.getElementById('lastCheck')

const userId = document.getElementById('user_id').value
const username = document.getElementById('username').value
const birthdayStart = document.getElementById('birthday_start').value
const birthdayStop = document.getElementById('birthday_stop').value
const lastCheck = document.getElementById('last_check').value
const subscribedBy = document.getElementById('subscribed_by').value

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


usernameInput.addEventListener('input', () => {
    usernameInput.classList.remove('positive', 'negative')
    if (usernameInput.getAttribute('before') !== usernameInput.value)
        usernameButton.removeAttribute('disabled')
    else
        usernameButton.setAttribute('disabled', true)
})

tagsInput.addEventListener('input', () => {
    tagsInput.classList.remove('positive', 'negative')
    tagsButton.removeAttribute('disabled')
})

ageInput1.addEventListener('input', () => {
    ageInput1.classList.remove('positive', 'negative')
    ageInput2.classList.remove('positive', 'negative')
    ageButton.removeAttribute('disabled')
    if (ageInput1.value.length > 0)
        ageInput2.removeAttribute('disabled')
    else
        ageInput2.setAttribute('disabled', true)
})

ageInput2.addEventListener('input', () => {
    ageInput1.classList.remove('positive', 'negative')
    ageInput2.classList.remove('positive', 'negative')
    ageButton.removeAttribute('disabled')
})



usernameButton.addEventListener('click', () => {
    usernameInput.setAttribute('disabled', true)
    usernameButton.setAttribute('disabled', true)
    fetch(`/api/user/update?id=${userId}&newUsername=${usernameInput.value}`).then(r => r.json()).then(json => {
        console.log('Returned json:', json)
        if (json.success) {
            location.href = '?username=' + json.fields.username
        } else usernameInput.classList.add('negative')
        usernameInput.removeAttribute('disabled')
    }).catch(err => console.log('Something went wrong with fetch:', err))
})

tagsButton.addEventListener('click', () => {
    tagsInput.setAttribute('disabled', true)
    tagsButton.setAttribute('disabled', true)
    fetch(`/api/usertag/update?id=${userId}&tags=${tagsInput.value}`).then(r => r.json()).then(json => {
        console.log('Returned json:', json)
        if (json.success) tagsInput.classList.add('positive')
        else              tagsInput.classList.add('negative')
        tagsInput.removeAttribute('disabled')
    }).catch(err => console.log('Something went wrong with fetch:', err))
})

ageButton.addEventListener('click', () => {
    ageButton.setAttribute('disabled', true)
    let url, stop, start
    if (ageInput1.value.length > 0) {
        start = Date.parse(ageInput1.value)
        if (ageInput2.value.length > 0) {
            stop = Date.parse(ageInput2.value)
            url = `/api/age/update?id=${userId}&start=${start}&stop=${stop}`
        } else if (ageInput1.value.length > 0)
            url = `/api/age/update?id=${userId}&start=${start}`
    } else {
        url = `/api/age/update?id=${userId}&delete`
    }
    fetch(url).then(r => r.json()).then(json => {
        console.log('Returned json:', json)
        if (json.success) {
            ageInput1.classList.add('positive')
            ageInput2.classList.add('positive')
            updateAge(json.age)
        } else {
            ageInput1.classList.add('negative')
            ageInput2.classList.add('negative')
        }
        if (ageInput1.value.length === 0)
            ageInput2.setAttribute('disabled', true)
    }).catch(err => console.log('Something went wrong with fetch:', err))
})

addToQueueButton.addEventListener('click', () => {
    if (activeLogin) {
        addToQueueButton.setAttribute('disabled', true)
        fetch(`/api/queue/add?type=profile&loginId=${activeLogin.login_id}&content=${username}`).then(r => r.json()).then(json => {
            console.log('Returned json:', json)
            addToQueueButton.classList.add('positive')
        }).catch(console.log)
    } else {
        addToQueueButton.classList.add('negative')
    }
})

addPostsToQueueButton.addEventListener('click', () => {
    if (activeLogin) {
        addPostsToQueueButton.setAttribute('disabled', true)
        fetch(`/api/user/posts2Queue?username=${username}&loginId=${activeLogin.login_id}`).then(r => r.json()).then(json => {
            console.log('Returned json:', json)
            addPostsToQueueButton.classList.add('positive')
        }).catch(console.log)
    } else {
        addPostsToQueueButton.classList.add('negative')
    }
})

downloadStoryButton.addEventListener('click', () => {
    if (activeLogin) {
        downloadStoryButton.setAttribute('disabled', true)
        fetch(`/api/queue/add?type=stories&loginId=${activeLogin.login_id}&content=${username}`).then(r => r.json()).then(json => {
            console.log('Returned json:', json)
            downloadStoryButton.classList.add('positive')
        })
    } else {
        downloadStoryButton.classList.add('negative')
    }
})

insertBirthYear.addEventListener('click', () => {
    let year = prompt('Enter year:')
    if (year && /^[0-9]{4}$/.test(year)) {
        let start = `${year}-01-01`, stop = `${year}-12-31`
        if (ageInput1.value !== start || ageInput2.value !== stop) {
            ageInput2.removeAttribute('disabled')
            ageButton.removeAttribute('disabled')
        }
        ageInput1.value = start
        ageInput2.value = stop
    }
})

insertAge.addEventListener('click', () => {
    let age = prompt('Enter age:')
    if (age && /^[0-9]{1,2}$/.test(age)) {
        age = parseInt(age)
        let startD = new Date(), stopD = new Date()
        startD.setFullYear(startD.getFullYear() - age - 1)
        startD.setDate(startD.getDate() + 1)
        stopD.setFullYear(stopD.getFullYear() - age)
        let start = startD.toISOString().replace(/(\d{4})-(\d{2})-(\d{2}).*/, '$1-$2-$3'),
            stop = stopD.toISOString().replace(/(\d{4})-(\d{2})-(\d{2}).*/, '$1-$2-$3')
        if (ageInput1.value !== start || ageInput2.value !== stop) {
            ageInput2.removeAttribute('disabled')
            ageButton.removeAttribute('disabled')
        }
        ageInput1.value = start
        ageInput2.value = stop
    }
})



function updateAge(age) {
    if (age && age.start) {
        ageElement.innerText = `${ageFromBirthdays(age.start, age.stop).string} years old`
    } else {
        ageElement.innerText = '-'
    }
}

updateAge({ start:birthdayStart, stop:birthdayStop })

var JSONBrowser

if (otherData) {
    JSONBrowser = makeJSONBrowser(otherData)
    JSONBrowser.register(obj => {
        console.log('Saving otherData:', obj)
        fetch(`/api/user/update?id=${userId}&otherData=${JSON.stringify(obj)}`).then(r => r.json()).then(json => {
            console.log('Returned json:', json)
        }).catch(console.log)
    })
}