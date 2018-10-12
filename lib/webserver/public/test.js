const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
$(function() {
    $("#slider-range").slider({
        range: true,
        min: 1990,
        max: 2014,
        step: 0.08333333333,
        values: [ 2003, 2005 ],
        slide: function( event, ui ) {
            let min = ui.values[0]
            let max = ui.values[1]
            let minMonth = months[Math.round((min - Math.floor(min))*12)]
            let maxMonth = months[Math.round((max - Math.floor(max))*12)]
            $("#amount")
                .val(`${minMonth} ${Math.floor(min)} - ${maxMonth} ${Math.floor(max)}`)
        }
    })

})

function slider(divElement, settings) {
    this.min    = settings.min || 0
    this.max    = settings.max || 10
    this.step   = settings.step || 0.5
    this.values = settings.values || [4,6]

    this.slider = divElement
    this.sliderRange     = this.slider.querySelector('.jo-slider-range')
    this.sliderHandleMin = this.slider.querySelector('.jo-slider-handle:nth-of-type(1)')
    this.sliderHandleMax = this.slider.querySelector('.jo-slider-handle:nth-of-type(2)')

    this.width       = this.slider.getBoundingClientRect().width
    this.leftOffset  = this.slider.getBoundingClientRect().x //+ 1 // WHY IS IT PLUS 1
    this.handleWidth = this.sliderHandleMin.getBoundingClientRect().width

    var self = this
    document.addEventListener('mousemove', ev => {
        if (self.toMove)
            self.toMove(ev.clientX)
    })

    document.addEventListener('mouseup', ev => {
        delete self.toMove
        self.adjust()
    })

    this.sliderHandleMin.addEventListener('mousedown', ev => {
        ev.preventDefault()
        self.zIndexMinAbove()
        self.toMove = x => self.moveMinTo(self.localXFromAbsolute(x))
    })

    this.sliderHandleMax.addEventListener('mousedown', ev => {
        ev.preventDefault()
        self.zIndexMaxAbove()
        self.toMove = x => self.moveMaxTo(self.localXFromAbsolute(x))
    })

    this.adjust()
}

slider.prototype.adjust = function() {
    this.currentMin = (this.values[1] - this.values[0]) / 3
    this.currentMax = this.values[1] + this.currentMin


    /// I NEED TO FUCKING PRINT CURRENT VALUES FFSSSS PISSES ME OFF, THERE ALSO HAS TO BE 
    /// ANIMATION FOR THIS NORMALIZED ADJUSTMENT, MAYBE 200ms LONG OR SOMETHING
}

slider.prototype.zIndexMinAbove = function() {
    this.sliderHandleMax.style.zIndex = '1'
    this.sliderHandleMin.style.zIndex = '2'
}

slider.prototype.zIndexMaxAbove = function() {
    this.sliderHandleMin.style.zIndex = '1'
    this.sliderHandleMax.style.zIndex = '2'
}

slider.prototype.moveMinTo = function(x) {
    let fixed = slider.fixBetween(x, 0, this.handleMaxRelativeX())
    let percentage = (fixed / this.width) * 100
    this.sliderHandleMin.style.left = `${percentage}%`
    this.sliderRange.style.left = this.sliderHandleMin.style.left
    this.sliderRange.style.width = ((this.handleMaxRelativeX() - this.handleMinRelativeX()) / this.width * 100) + '%'
    this.values[0] = this.currentMin + ((this.currentMax - this.currentMin) * percentage / 100)
}

slider.prototype.moveMaxTo = function(x) {
    let fixed = slider.fixBetween(x, this.handleMinRelativeX(), this.width)
    let percentage = (fixed / this.width) * 100
    this.sliderHandleMax.style.left = `${percentage}%`
    this.sliderRange.style.left = this.sliderHandleMin.style.left
    this.sliderRange.style.width = ((this.handleMaxRelativeX() - this.handleMinRelativeX()) / this.width * 100) + '%'
    this.values[1] = this.currentMin + ((this.currentMax - this.currentMin) * percentage / 100)
}

slider.prototype.handleMinRelativeX = function() { return Math.round(this.sliderHandleMin.getBoundingClientRect().x) - this.leftOffset + this.handleWidth/2 + 1 }
slider.prototype.handleMaxRelativeX = function() { return Math.round(this.sliderHandleMax.getBoundingClientRect().x) - this.leftOffset + this.handleWidth/2 + 1 }
slider.prototype.localXFromAbsolute = function(x) { return x - this.leftOffset }
slider.fixBetween = (n, min, max) => Math.max(min, Math.min(max, n))


let mySlider = new slider(document.querySelector('#mySlider'), {
})

// let sliderObj = {
//     min: 1990,
//     max: 2018,
//     step: 0.08333333333,
//     values: [2003, 2005]
// }
// sliderObj.slider          = document.querySelector('#mySlider')
// sliderObj.sliderRange     = document.querySelector('#mySlider > .jo-slider-range')
// sliderObj.sliderHandleMin = document.querySelector('#mySlider > .jo-slider-handle:nth-of-type(1)')
// sliderObj.sliderHandleMax = document.querySelector('#mySlider > .jo-slider-handle:nth-of-type(2)')

// sliderObj.width       = sliderObj.slider.getBoundingClientRect().width
// sliderObj.leftOffset  = sliderObj.slider.getBoundingClientRect().x + 1
// sliderObj.handleWidth = sliderObj.sliderHandleMin.getBoundingClientRect().width

// // sliderObj.slider.addEventListener('resize', ev => {
// // })
// document.addEventListener('mousemove', ev => {
//     if (sliderObj.toMove)
//         sliderObj.toMove(ev.clientX)
// })
// sliderObj.sliderHandleMin.addEventListener('mousedown', ev => {
//     ev.preventDefault()
//     sliderObj.sliderHandleMax.style.zIndex = '1'
//     sliderObj.sliderHandleMin.style.zIndex = '2'
//     sliderObj.toMove = x => {
//         let localX = localXFromAbsolute(x)
//         let fixed = fixBetween(localX, 0, handleMaxRelativeX())
//         let percentage = (fixed / sliderObj.width) * 100
//         sliderObj.sliderHandleMin.style.left = `${percentage}%`
//         sliderObj.sliderRange.style.left = sliderObj.sliderHandleMin.style.left
//         sliderObj.sliderRange.style.width = ((handleMaxRelativeX() - handleMinRelativeX()) / sliderObj.width * 100) + '%'
//     }
// })
// sliderObj.sliderHandleMax.addEventListener('mousedown', ev => {
//     ev.preventDefault()
//     sliderObj.sliderHandleMin.style.zIndex = '1'
//     sliderObj.sliderHandleMax.style.zIndex = '2'
//     sliderObj.toMove = x => {
//         let localX = localXFromAbsolute(x)
//         let fixed = fixBetween(localX, handleMinRelativeX(), sliderObj.width)
//         let percentage = (fixed / sliderObj.width) * 100
//         sliderObj.sliderHandleMax.style.left = `${percentage}%`
//         sliderObj.sliderRange.style.left = sliderObj.sliderHandleMin.style.left
//         sliderObj.sliderRange.style.width = ((handleMaxRelativeX() - handleMinRelativeX()) / sliderObj.width * 100) + '%'
//     }
// })
// document.addEventListener('mouseup', ev => {
//     delete sliderObj.toMove

// })



// const handleMinRelativeX = () => Math.round(sliderObj.sliderHandleMin.getBoundingClientRect().x) - sliderObj.leftOffset + sliderObj.handleWidth/2 + 1
// const handleMaxRelativeX = () => Math.round(sliderObj.sliderHandleMax.getBoundingClientRect().x) - sliderObj.leftOffset + sliderObj.handleWidth/2 + 1
// const localXFromAbsolute = x => x - sliderObj.leftOffset
// const fixBetween         = (n, min, max) => Math.max(min, Math.min(max, n))