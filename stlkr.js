console.log('          Welcome to StlkR.         ')
console.log('  --------------------------------  ')
console.log('   This application was developed   ')
console.log('            by Gallienus.           ')
console.log('   (https://github.com/Gallienus)   ')
console.log('  --------------------------------\n')

if (process.argv.length <= 2) {
    // Usage: node stlkr <mode>
    console.log('Usage: node stlkr <mode>')
    console.log(' Where mode is one of the following:')
    console.log(' - full')
    console.log(' - webserveronly')
    console.log(' - downloadonly')
    console.log(' - removeduplicates') // remove duplicate media in storage folder
} else {
    let mode = process.argv[2].toLowerCase()

    if (mode === 'full') {
        console.log('Starting StlkR in <full> mode.')

        require('webserver')
    }


    else if (mode === 'removeduplicates') {
        console.log('Starting StlkR in <removeduplicates> mode.')
    }
}