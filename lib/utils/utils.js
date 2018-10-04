const request = require('request')
const path    = require('path')
const fs      = require('fs-extra')
const hasha   = require('hasha')

const config = require('../../config')

const _ALGO = 'md5'

fs.ensureDirSync(config.paths.storageFolder)
fs.ensureDirSync(config.paths.trashcanFolder)

function object2Arrays(obj) {
    let keys = []
    let values = []
    for (let key in obj) {
        keys.push(key)
        values.push(obj[key])
    }
    return { keys, values }
}

function fixNumberInString(str) {
    if (typeof str !== 'string') return str
    return parseInt(str.replace(/[,.]/g, ''))
}

function fileNameFromUrl(url) {
    try {
        return /\/([0-9_a-z]*?\.[a-z0-9]*)$/.exec(url.split('?')[0])[1]
    } catch(e) {
        return null
    }
}

function hashFromFile(path) {
    return new Promise((resolve, reject) => {
        hasha.fromFile(path, { algorithm: _ALGO }).then(hash => {
            resolve(hash)
        }).catch(err => {
            reject(err)
        })
    })
}

function mediaExists(url) {
    return new Promise((resolve, reject) => {
        if (url && url.length > 0) {
            let fileName = fileNameFromUrl(url)
            if (fs.existsSync(path.join(config.paths.storageFolder, fileName))) {
                resolve(true)
            } else {
                resolve(false)
            }
        } else
            reject('no url')
    })
}

function downloadMedia(url) {
    return new Promise((resolve, reject) => {
        if (url && url.length > 0) {
            let fileName = fileNameFromUrl(url)
            request(url).pipe(fs.createWriteStream(path.join(config.paths.storageFolder, fileName))).on('finish', () => {
                resolve(fileName)
            }).on('error', err => {
                reject(err)
            })
        } else
            reject('no url')
    })
}

function moveToTrash(filename) {
    return new Promise((resolve, reject) => {
        if (filename && typeof filename === 'string' && filename.length > 0) {
            let from = path.join(__dirname, '..', config.storageFolder.relativePath, filename),
                  to = path.join(__dirname, '..', config.trashcanFolder.relativePath, filename)
            fs.exists(from, ex => {
                if (ex) {
                    fs.rename(from, to, err => {
                        if (err) reject(err)
                        else     resolve(true)
                    })
                } else {
                    reject('file does not exist')
                }
            })
        } else {
            reject('no filename')
        }
    })
}

function average(n1, n2) {
    return (n1 + n2) / 2
}

// obj2 overwrites obj1
function merge(obj1, obj2) {
    let obj = JSON.parse(JSON.stringify(obj1))
    for (let key in obj2)
        obj[key] = obj2[key]
    return obj
}

module.exports = {
    average,
    downloadMedia, 
    fileNameFromUrl, 
    fixNumberInString,
    hashFromFile,
    mediaExists,
    merge,
    moveToTrash,
    object2Arrays,
}