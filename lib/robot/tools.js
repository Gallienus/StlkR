/* 
Some of these should be implemented into the rest of the application eventually
*/

const database = require('database')
const utils = require('utils')
const path = require('path')

const config = require('../../config')

async function trashFilesNotInDb() {
    const fs = require('fs')

    let filenames = await (database.query.all(
        `SELECT user_profile_picture.filename FROM user_profile_picture WHERE user_profile_picture.filename IS NOT NULL
        UNION SELECT content.media_filename as filename FROM content WHERE content.media_filename IS NOT NULL
        UNION SELECT content.preview_filename as filename FROM content WHERE content.preview_filename IS NOT NULL
        UNION SELECT story.media_filename as filename FROM story WHERE story.media_filename IS NOT NULL
        UNION SELECT story.preview_filename as filename FROM story WHERE story.preview_filename IS NOT NULL`))
    filenames = filenames.map(row => row.filename)

    let filesNotInDb = []
    let dbNotInFiles = []

    for (let filename of filenames) {
        if (!fs.existsSync(path.join(config.paths.storageFolder, filename))) {
            dbNotInFiles.push(filename)
        }
    }

    let files = fs.readdirSync(config.paths.storageFolder)
    for (let filename of files) {
        if (path.join(config.paths.storageFolder, filename) !== config.paths.trashcanFolder) {
            if (filenames.indexOf(filename) < 0) {
                filesNotInDb.push(filename)
            }
        }
    }

    for (let filename of filesNotInDb) {
        fs.renameSync(
            path.join(config.paths.storageFolder, filename),
            path.join(config.paths.trashcanFolder, filename))
    }

    console.log('Moved', filesNotInDb.length, 'files from storage folder to trashcan folder.')
    console.log('Found', dbNotInFiles.length, 'files in database that does not exist in the storage folder:')
    console.log(dbNotInFiles.map(f => ` - ${f}`).join('\n'))
}

async function mergeUsers(sourceId, targetId, deleteSource=false) {
    if (await (database.isUserById(sourceId))
            && await (database.isUserById(targetId))) {
        await (database.query.run('UPDATE post SET user_id = ? WHERE user_id = ?', targetId, sourceId))
        await (database.query.run('UPDATE user_real_name SET user_id = ? WHERE user_id = ?', targetId, sourceId))
        await (database.query.run('UPDATE user_biography SET user_id = ? WHERE user_id = ?', targetId, sourceId))
        await (database.query.run('UPDATE user_web_page SET user_id = ? WHERE user_id = ?', targetId, sourceId))
        await (database.query.run('UPDATE user_profile_picture SET user_id = ? WHERE user_id = ?', targetId, sourceId))
        await (database.query.run('UPDATE user_age SET user_id = ? WHERE user_id = ?', targetId, sourceId))
        await (database.query.run('UPDATE user_tag SET user_id = ? WHERE user_id = ?', targetId, sourceId))
        await (database.query.run('UPDATE user_other SET user_id = ? WHERE user_id = ?', targetId, sourceId))
        // TODO: real_name, biography, web_page and profile_picture can be duplicate after above is run

        if (deleteSource)
            await (database.query.run('DELETE FROM user WHERE user_id = ?', sourceId))
        
        return true
    } else {
        return false
    }
}

/*
Works for tables:
- user_real_name
- user_biography
- user_web_page
*/
async function mergeDuplicates(table) {
    let duplicates = await (database.query.all(
        `SELECT *
        FROM ${table}
        WHERE value IN (
            SELECT value
            FROM ${table}
            GROUP BY value
            HAVING count(*) > 1
        ) ORDER BY value`
    ))

    if (duplicates) {
        let objects = {}
        let toDelete = []
        for (let duplicate of duplicates) {
            toDelete.push(duplicate.id)
            if (!objects[duplicate.user_id]) {
                objects[duplicate.user_id] = {
                    user_id:duplicate.user_id,
                    value:duplicate.value,
                    first_seen:duplicate.first_seen,
                    last_seen:duplicate.last_seen
                }
            } else {
                if (objects[duplicate.user_id].first_seen > duplicate.first_seen)
                    objects[duplicate.user_id].first_seen = duplicate.first_seen

                if (objects[duplicate.user_id].last_seen < duplicate.last_seen)
                    objects[duplicate.user_id].last_seen = duplicate.last_seen
            }
        }

        let toSet = []
        for (let key in objects) {
            console.log('user_id', key)
            toSet.push([
                key,
                objects[key].value,
                objects[key].first_seen,
                objects[key].last_seen
            ])
        }

        console.log('Pushing to database', toSet)
        await (database.set.apply(null, [table, ['user_id', 'value', 'first_seen', 'last_seen'], ...toSet]))

        for (let id of toDelete) {
            console.log('Deleting from', table, 'where id =', id)
            await (database.query.run(`DELETE FROM ${table} WHERE id = ?`, id))
        }

        console.log('Fixed', toSet.length, 'duplicates - done')
        return true
    } else {
        Console.log('No duplicates - done')
        return false
    }
}



// TODO: content too?
async function ensureMd5() {
    let toHash = 0

    let stories = await (database.query.all('SELECT * FROM story WHERE md5 IS NULL'))
    let profilePictures = await (database.query.all('SELECT * FROM user_profile_picture WHERE md5 IS NULL AND filename IS NOT NULL'))
    
    toHash += stories.length
    toHash += profilePictures.length
    
    console.log('Hashing', stories.length, 'stories')
    console.log('Hashing', profilePictures.length, 'profile pictures')
    console.log('Hashing', toHash, 'in total...this may take a while.')

    stories.forEach(async story => {
        let md5
        if (story.is_video === 1) {
            md5 = await (utils.hashFromFile(path.join(config.paths.storageFolder, story.preview_filename)))
        } else {
            md5 = await (utils.hashFromFile(path.join(config.paths.storageFolder, story.media_filename)))
        }

        await (database.query.run('UPDATE story SET md5 = ? WHERE id = ?', md5, story.id))

        toHash--
        if (toHash % 25 === 0)
            console.log('Hashing', toHash, 'more...')
    })

    profilePictures.forEach(async profilePicture => {
        let md5 = await (utils.hashFromFile(path.join(config.paths.storageFolder, profilePicture.filename)))

        await (database.query.run('UPDATE user_profile_picture SET md5 = ? WHERE id = ?', md5, profilePicture.id))
        
        toHash--
        if (toHash % 25 === 0)
            console.log('Hashing', toHash, 'more...')
    })
}


module.exports = {
    ensureMd5,
    mergeUsers,
    mergeDuplicates,
    trashFilesNotInDb,
}