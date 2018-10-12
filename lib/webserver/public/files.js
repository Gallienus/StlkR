document.addEventListener('keypress', function(e) {
    var c, el, w;
    e.preventDefault();
    switch (e.key) {
        case 'd':
            c = currentParagraph();
            el = $(c).prev();
            $('html, body').animate({
                scrollTop: el.offset().top
            }, 150);
            break;
        case 'f':
            c = currentParagraph();
            el = $(c).next();
            $('html, body').animate({
                scrollTop: el.offset().top
            }, 150);
            break;
        case ' ':
            c = $(currentParagraph());
            el = $(c).children('video');
            if (el.length > 0) {
                el = el[0];
                if (el.paused)
                    el.play();
                else
                    el.pause();
            }
            break;
        case 'g':
            c = $(currentParagraph().children[0]);
            w = c.width();
            c.css('width', w + 50 + 'px');
            c.css('height', (w + 50) / w * c.height() + 'px');
            break;
        case 'v':
            c = $(currentParagraph().children[0]);
            w = c.width();
            c.css('width', w - 50 + 'px');
            c.css('height', (w - 50) / w * c.height() + 'px');
            break;
    }
});

function currentParagraph() {
    var winTop = $(this).scrollTop();
    var $divs = $('p');

    var top = $.grep($divs, function(item) {
        return $(item).position().top <= winTop;
    });

    return top.pop() || $('p')[0];
}
