function formatDate(date) {
    return date.toISOString().replace(/(\d{4})-(\d{2})-(\d{2}).*/, '$1-$2-$3')
}

function ageFromBirthday(birthday) {
    if (birthday == null) return null
    if (typeof birthday === 'string') birthday = parseInt(birthday)
    if (typeof birthday === 'number') birthday = new Date(birthday)
    let ageDifMs = Date.now() - birthday.getTime()
    return Math.abs(new Date(ageDifMs).getUTCFullYear() - 1970);
}

function ageFromBirthdays(bStart, bStop) {
    let age, high = ageFromBirthday(bStart), low
    if (bStop) {
        low = ageFromBirthday(bStop)
        if (high === low) {
            age = { high, low, same:true, exact:false, string:`~${low}` }
        } else {
            age = { high, low, same:false, exact:false, string:`~${low}-${high}` }
        }
    } else {
        age = { high, low:high, same:true, exact:true, string:`${high}` }
    }
    return age
}

function addParams(url, params) {
    if (url && params) {
        return url + '?' + Object
                .keys(params)
                .filter(k => params[k] != null)
                .map(k => `${k}=${params[k]}`)
                .join('&')
    } else {
        return null
    }
}

function makeJSONBrowser(node) {
    let json
    try {
        json = JSON.parse(node.innerText)
    } catch (e) {
        json = { BAD_JSON:node.innerText }
    }

    node.classList.add('JSONBrowser')

    let callbacks = []
    function trigger() {
        if (callbacks.length) {
            let obj = objectFromHtml()
            callbacks.forEach(cb => {
                cb(obj)
            })
        }
    }

    function objectFromHtml() {
        function nextLevel(nextNode) {
            let obj = {}
            if (nextNode.children && nextNode.children[0].children) {
                for (let i = 0; i < nextNode.children[0].children.length; i++) {
                    let td = nextNode.children[0].children[i], keyNode
                    if ((keyNode = td.querySelector('input'))) {
                        let nextElement = keyNode.nextElementSibling
                        if (nextElement) {
                            if (nextElement.tagName === 'TABLE') {
                                obj[keyNode.value] = nextLevel(nextElement)
                            } else {
                                obj[keyNode.value] = nextElement.value
                            }
                        }
                    }
                }
            } else {
                console.log('Has no children:', nextNode)
            }
            return obj
        }
        return nextLevel(node.children[0])
    }

    function htmlFromObject(obj) {
        let html = '<table>'
        for (let key in obj) {
            let val = obj[key]
            if (typeof val === 'object') {
                html += `<tr><td><input value="${key}">↓${htmlFromObject(val)}</td></tr>`
            } else if (val instanceof Array) {

            } else {
                html += `<tr><td><input value="${key}">→<input value="${val}"></td></tr>`
            }
        }
        html += '<tr><td><a href="javascript:void(0)">Add pair...</a></td></tr></table>'
        return html
    }

    node.innerHTML = htmlFromObject(json)

    function removeIfEmpty(target) {
        if (!target.value.length) {
            if ((target.previousElementSibling && !target.previousElementSibling.value.length) ||
                (target.nextElementSibling && (!target.nextElementSibling.value || !target.nextElementSibling.value.length))) {
                    target.parentNode.parentNode.parentNode.remove()
                    return true
                }
        }
        return false
    }

    node.addEventListener('click', ev => {
        if (ev.target && ev.target.tagName === 'A') {
            let pn = ev.target.parentNode
            let clone = pn.parentNode.cloneNode(true)
            pn.parentNode.parentNode.appendChild(clone)
            pn.innerHTML = '<input>→<input>'
            pn.children[0].focus()
        }
    })

    node.addEventListener('focusout', ev => {
        removeIfEmpty(ev.target)
    })

    node.addEventListener('keypress', ev => {
        if (ev.key === 'Enter') {
            if (!removeIfEmpty(ev.target)) {
                if (!ev.target.nextElementSibling) {
                    if (ev.target.value === '{}') {
                        let pn = ev.target.parentNode
                        ev.target.remove()
                        pn.innerHTML = `<input value="${pn.children[0].value}">↓${htmlFromObject({})}`
                    } else if (ev.target.value === '[]') {

                    } else {
                        trigger()
                    }
                }
            }
        }
    })

    return { json, objectFromHtml, register:callback => callbacks.push(callback) }
}

function intervalParse(str) {
    if (/^[0-9*+-/dhms]+$/.test(str)) {
        str = str.replace(/([0-9])(d|h|m|s)/g, '$1*$2')
        str = str.replace(/d/g, 86400000)
        str = str.replace(/h/g, 3600000)
        str = str.replace(/m/g, 60000)
        str = str.replace(/s/g, 1000)
        return eval(str)
    }
    return false
}