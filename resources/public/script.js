var back = document.getElementById('back');

if (back) {
    back.addEventListener('click', function(e) {
        e.preventDefault();
        window.history.back();
    });
}

document.addEventListener('keypress', function(e) {
    switch (e.key) {
        case 'a':
            if (window.location.pathname !== '/')
                window.history.back();
            break;
        case 's':
            if (window.location.pathname !== '/')
                window.location.href = '/';
            break;

    }
});
