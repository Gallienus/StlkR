
const ageWhenPosted = document.getElementById('ageWhenPosted')
const ageNow = document.getElementById('ageNow')
const uploadedEl = document.getElementById('uploadedEl')

const addToQueueButton = document.getElementById('addToQueue')
const deleteContentsButton = document.getElementById('deleteContents')


const birthdayStart = document.getElementById('user_birthday_start').value
const birthdayStop = document.getElementById('user_birthday_stop').value
const uploaded = document.getElementById('uploaded').value
const code = document.getElementById('code').value


addToQueueButton.addEventListener('click', () => {
    addToQueueButton.setAttribute('disabled', true)
    fetch(`/api/queue/add?type=post&content=${code}`).then(r => r.json()).then(json => {
        console.log('Returned json:', json)
        addToQueueButton.style.backgroundColor = 'green'
    }).catch(console.log)
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
