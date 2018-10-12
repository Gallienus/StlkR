const defaultValue = '2003-01-01'

document.forms[0].addEventListener('submit', () => {
    let inputs = document.querySelectorAll('input')

    let toUpdate = {}

    for (let i = 0; i < inputs.length-2; i+=2) {
        let inp = inputs[i]
        if (inp.value !== defaultValue && inp.value.length > 0) {
            let birthday = new Date(inputs[i].value).getTime()
            let accuracy = inputs[i+1].value
            if (accuracy.length > 0)
                accuracy = Math.abs(parseFloat(accuracy))
            else
                accuracy = 0
            toUpdate[parseInt(inputs[i].getAttribute('user'))] = {
                birthday: birthday,
                accuracy: accuracy
            }
        }
    }

    document.querySelector('input[type="hidden"]').value = JSON.stringify(toUpdate)
})