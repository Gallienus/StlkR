// Configuration file
// =========== OK TO EDIT BELOW ============

let config = {
    paths: {
        // Path to SQLite3 database file
        // (Only used when using SQLite3 for storage)
        database: 'resources/database.sqlite3',

        // Path to stored images/videos
        storageFolder: 'storage',

        // Path to trashed image/video files
        // (Eg. auto-detected dubbles and when user deletes individual media)
        trashcanFolder: 'storage/trashcan'
    },
        
    // User agent to use for requests to Instagram
    // userAgent: "Instagram 9.5.1 (iPhone9,2; iOS 10_0_2; en_US; en-US; scale=2.61; 1080x1920) AppleWebKit/420+",
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',

    // The max amounts of requests allowed to be open at the same time
    maxOpenRequests: 5,
    
    // Ports for the webserver
    // (Only used when the webserver is running)
    webserverHttpPort: 8080,
    webserverHttpsPort: 8443,
}



// =========== DO NOT EDIT BELOW ============

const homedir = require('os').homedir()

if (config.paths) {
    for (let k in config.paths) {
        if (typeof config.paths[k] === 'string') {
            config.paths[k] = config.paths[k].replace('~', homedir)
        }
    }
}

module.exports = config