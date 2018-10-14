console.log('          Welcome to StlkR.         ')
console.log('  --------------------------------  ')
console.log('   This application was developed   ')
console.log('            by Gallienus.           ')
console.log('   (https://github.com/Gallienus)   ')
console.log('  --------------------------------\n')

if (process.argv.length <= 2) {
    // Usage: node stlkr <mode>
    console.log('Usage: node stlkr <mode>')
    console.log(' Where <mode> is one of the following:')
    console.log(' - full')
    console.log(' - removeduplicates')
    console.log(' - ensuremd5') // make sure all pictures in storage has md5 sig
    console.log(' - webserveronly')
    console.log(' - downloadonly')
} else {
    let mode = process.argv[2].toLowerCase()

    if (mode === 'full') {
        console.log('Starting StlkR in <full> mode.')

        require('webserver')
    }

    else if (mode === 'removeduplicates') {
        console.log('Starting StlkR in <RemoveDuplicates> mode.')

        if (process.argv.length <= 3) {
            // Usage: node stlkr removeduplicates <table>
            console.log('Usage: node stlkr removeduplicates <table>')
            console.log(' Where <table> is one of the following:')
            console.log(' - user_real_name')
            console.log(' - user_biography')
            console.log(' - user_web_page')
        } else {
            let table = process.argv[3].toLocaleLowerCase()
    
            if (table === 'user_real_name'
                    || table === 'user_biography'
                    || table === 'user_web_page') {
                require('./lib/robot/tools').mergeRealNameDuplicates(table)
            }

            else if (table === '') {

            }
        }
    }

    else if (mode === 'ensuremd5') {
        console.log('Starting StlkR in <EnsureMD5> mode.')

        require('./lib/robot/tools').ensureMd5()
    }
}