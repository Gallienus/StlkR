const form = document.forms[0]

form.addEventListener('submit', () => {
    let inputs = document.querySelectorAll('input.form')

    let toUpdate = {}

    for (let i = 0; i < inputs.length; i+=2) {
        let startInput = inputs[i]
        let stopInput = inputs[i+1]
        if (startInput.value && startInput.value.length > 0) {
            if (startInput.value !== startInput.getAttribute('before') || stopInput.value !== stopInput.getAttribute('before')) {
                let start = startInput.value
    
                if (stopInput.value.length > 0)
                    toUpdate[startInput.getAttribute('user')] = { start:Date.parse(start), stop:Date.parse(stopInput.value) }
                else
                    toUpdate[startInput.getAttribute('user')] = { start:Date.parse(start) }
            }
        }
    }

    form.toUpdate.value = JSON.stringify(toUpdate)
})

// document.addEventListener('click', ev => {
//     if (ev.target.tagName === 'BUTTON') {
//         if (ev.target.classList.contains('switchInput')) {
            
//         }
//     }
// })

document.addEventListener('input', (ev) => {
    if (ev.target.tagName === 'INPUT') {
        if (ev.target.type === 'date') {
            let start, stop

            if (ev.target.classList.contains('start')) {
                start = ev.target
                stop  = ev.target.parentElement.nextSibling.children[0]
                if (ev.target.value !== '') {
                    stop.removeAttribute('disabled')
                } else {
                    stop.setAttribute('disabled', true)
                }
            }

            if (ev.target.classList.contains('stop')) {
                start = ev.target.parentElement.previousSibling.children[0]
                stop  = ev.target
            }

            if (start.value.length > 0)
                ev.target.parentElement.parentElement.querySelector('.displayAge').innerText = estimateFromVals(start.value, stop.value)
            else
                ev.target.parentElement.parentElement.querySelector('.displayAge').innerText = '-'
        }
    }
})

function dbFromVals(start, stop) {
    let startD = new Date(start).getTime()
    let stopD = stop.length > 0 ? new Date(stop).getTime() : startD
    let halfDiff = (stopD - startD) / 2
    return { birthday:startD + halfDiff, accuracy:halfDiff / 31557600000, startD:startD, stopD:stopD }
}

function estimateFromDb(db) {
    let prefix = db.accuracy === 0 ? '' : '~'
    let low = Math.floor((Date.now() - db.stopD) / 31557600000)
    let high = Math.floor((Date.now() - db.startD) / 31557600000)
    if (db.accuracy === 0)
        return `${prefix}${low} years old`
    else
       return `${prefix}${low}-${high} years old`
    return 
}

function estimateFromVals(start, stop) {
    return estimateFromDb(dbFromVals(start, stop))
}