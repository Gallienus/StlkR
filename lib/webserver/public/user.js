const tagsInput  = document.getElementById('tags')
const tagsButton = document.getElementById('updateTags')

const usernameInput = document.getElementById('usernameInput')
const usernameButton = document.getElementById('updateUsername')

const intervalInput = document.getElementById('interval')
const intervalButton = document.getElementById('updateInterval')

const ageInput1 = document.getElementById('birthdayStart')
const ageInput2 = document.getElementById('birthdayStop')
const ageButton = document.getElementById('updateAge')
const insertBirthYear = document.getElementById('insertBirthYear')
const insertAge = document.getElementById('insertAge')
const ageElement = document.getElementById('age')

const dlopCheckbox = document.getElementById('dlop')

const addToQueueButton = document.getElementById('addToQueue')
const addPostsToQueueButton = document.getElementById('addPostsToQueue')
const downloadStoryButton = document.getElementById('downloadStory')

const otherData = document.getElementById('otherData')


const userId = document.getElementById('user_id').value
const username = document.getElementById('username').value
const birthdayStart = document.getElementById('birthday_start').value
const birthdayStop = document.getElementById('birthday_stop').value


usernameInput.addEventListener('input', () => {
    usernameInput.classList.remove('positive', 'negative')
    if (usernameInput.getAttribute('before') !== usernameInput.value)
        usernameButton.removeAttribute('disabled')
    else
        usernameButton.setAttribute('disabled', true)
})

intervalInput.addEventListener('input', () => {
    intervalInput.classList.remove('positive', 'negative')
    if (intervalInput.getAttribute('before') !== intervalInput.value)
        intervalButton.removeAttribute('disabled')
    else
        intervalButton.setAttribute('disabled', true)
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

dlopCheckbox.addEventListener('change', () => {
    dlopCheckbox.setAttribute('disabled', true)
    fetch(`/api/user/update?id=${userId}&downloadAllPosts=${dlopCheckbox.checked ? 1 : 0}`).then(r => r.json()).then(json => {
        console.log('Returned json:', json)
        if (json.success)
            dlopCheckbox.checked = dlopCheckbox.checked
        dlopCheckbox.removeAttribute('disabled')
    }).catch(err => console.log('Something went wrong with fetch:', err))
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

intervalButton.addEventListener('click', () => {
    intervalInput.setAttribute('disabled', true)
    intervalButton.setAttribute('disabled', true)
    let interval = intervalParse(intervalInput.value)
    if (interval) {
        fetch(`/api/storySubscription/update?username=${username}&interval=${interval}`).then(r => r.json()).then(json => {
            console.log('Returned json:', json)
            if (json.success) {
                intervalInput.classList.add('positive')
                intervalInput.value = json.interval
            } else {
                intervalInput.classList.add('negative')
            }
            intervalInput.removeAttribute('disabled')
        }).catch(err => console.log('Something went wrong with fetch:', err))
    }
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
    addToQueueButton.setAttribute('disabled', true)
    fetch(`/api/queue/add?type=profile&content=${username}`).then(r => r.json()).then(json => {
        console.log('Returned json:', json)
        addToQueueButton.classList.add('positive')
    }).catch(console.log)
})

addPostsToQueueButton.addEventListener('click', () => {
    addPostsToQueueButton.setAttribute('disabled', true)
    fetch(`/api/user/posts2Queue?username=${username}`).then(r => r.json()).then(json => {
        console.log('Returned json:', json)
        addPostsToQueueButton.classList.add('positive')
    }).catch(console.log)
})

downloadStoryButton.addEventListener('click', () => {
    downloadStoryButton.setAttribute('disabled', true)
    fetch(`/api/queue/add?type=stories&content=${username}`).then(r => r.json()).then(json => {
        console.log('Returned json:', json)
        downloadStoryButton.classList.add('positive')
    })
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