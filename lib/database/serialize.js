// database structure

function serialize(db) {

    db.serialize(() => {
        
        db.run(`CREATE TABLE IF NOT EXISTS "user" (
            id                   INTEGER PRIMARY KEY,
            instagram_id         TEXT,
            post_count           INTEGER,
            followers_count      INTEGER,
            following_count      INTEGER,
            still_exists         BOOLEAN DEFAULT 1,
            is_private           BOOLEAN DEFAULT 0,
            is_verified          BOOLEAN DEFAULT 0,
            is_business          BOOLEAN DEFAULT 0,
            business_email       TEXT,
            business_category    TEXT,
            business_phone       TEXT,
            business_address     TEXT,
            username             TEXT UNIQUE NOT NULL,
            last_check           INTEGER
        )`)

        db.run(`CREATE TABLE IF NOT EXISTS "user_real_name" (
            id         INTEGER PRIMARY KEY,
            user_id    INTEGER NOT NULL,
            value      TEXT NOT NULL,
            first_seen INTEGER NOT NULL,
            last_seen  INTEGER NOT NULL
        )`)

        db.run(`CREATE TABLE IF NOT EXISTS "user_biography" (
            id         INTEGER PRIMARY KEY,
            user_id    INTEGER NOT NULL,
            value      TEXT NOT NULL,
            first_seen INTEGER NOT NULL,
            last_seen  INTEGER NOT NULL
        )`)

        db.run(`CREATE TABLE IF NOT EXISTS "user_web_page" (
            id         INTEGER PRIMARY KEY,
            user_id    INTEGER NOT NULL,
            value      TEXT NOT NULL,
            first_seen INTEGER NOT NULL,
            last_seen  INTEGER NOT NULL
        )`)

        db.run(`CREATE TABLE IF NOT EXISTS "user_profile_picture" (
            id         INTEGER PRIMARY KEY,
            user_id    INTEGER NOT NULL,
            url        TEXT NOT NULL,
            filename   TEXT,
            md5        TEXT,
            first_seen INTEGER NOT NULL,
            last_seen  INTEGER NOT NULL
        )`)
        
        db.run(`CREATE TABLE IF NOT EXISTS "user_age" (
            id             INTEGER PRIMARY KEY,
            user_id        INTEGER NOT NULL,
            birthday_start INTEGER NOT NULL,
            birthday_stop  INTEGER
        )`)

        db.run(`CREATE TABLE IF NOT EXISTS "user_tag" (
            id      INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            value   TEXT NOT NULL
        )`)

        db.run(`CREATE TABLE IF NOT EXISTS "user_other" (
            id      INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            key     TEXT NOT NULL,
            value   TEXT NOT NULL
        )`)


    
        db.run(`CREATE TABLE IF NOT EXISTS "post" (
            id                INTEGER PRIMARY KEY,
            user_id           INTEGER NOT NULL,
            instagram_id      TEXT,
            code              TEXT UNIQUE NOT NULL,
            uploaded          INTEGER,
            caption           TEXT,
            comments_disabled BOOLEAN DEFAULT 0,
            comment_count     INTEGER,
            like_count        INTEGER,
            still_exists      BOOLEAN DEFAULT 1,
            saved_content     BOOLEAN DEFAULT 0,
            last_check        INTEGER
        )`)

        db.run(`CREATE TABLE IF NOT EXISTS "post_tagged_user" (
            id           INTEGER PRIMARY KEY,
            post_id      INTEGER NOT NULL,
            instagram_id TEXT NOT NULL,
            username     TEXT NOT NULL,
            x            INTEGER NOT NULL,
            y            INTEGER NOT NULL,
            user_id      INTEGER
        )`)

        db.run(`CREATE TABLE IF NOT EXISTS "post_tag" (
            id      INTEGER PRIMARY KEY,
            post_id INTEGER NOT NULL,
            value   TEXT NOT NULL
        )`)

        db.run(`CREATE TABLE IF NOT EXISTS "post_other" (
            id      INTEGER PRIMARY KEY,
            post_id INTEGER NOT NULL,
            key     TEXT NOT NULL,
            value   TEXT NOT NULL
        )`)
        

            
        db.run(`CREATE TABLE IF NOT EXISTS "content" (
            id               INTEGER PRIMARY KEY,
            post_id          INTEGER,
            instagram_id     TEXT,
            width            INTEGER,
            height           INTEGER,
            is_video         BOOLEAN DEFAULT 0,
            media_url        TEXT,
            preview_url      TEXT,
            md5              TEXT,
            media_filename   TEXT,
            preview_filename TEXT,
            stored_locally   BOOLEAN DEFAULT 0
        )`)

        db.run(`CREATE TABLE IF NOT EXISTS "content_tag" (
            id         INTEGER PRIMARY KEY,
            content_id INTEGER NOT NULL,
            value      TEXT NOT NULL
        )`)



        db.run(`CREATE TABLE IF NOT EXISTS "story" (
            id               INTEGER PRIMARY KEY,
            user_id          INTEGER,
            instagram_id     TEXT UNIQUE,
            uploaded         INTEGER,
            width            INTEGER,
            height           INTEGER,
            is_video         BOOLEAN DEFAULT 0,
            md5              TEXT,
            media_filename   TEXT,
            preview_filename TEXT
        )`)



        db.run(`CREATE TABLE IF NOT EXISTS "login" (
            id         INTEGER PRIMARY KEY,
            username   TEXT UNIQUE NOT NULL,
            password   TEXT NOT NULL,
            ds_user_id TEXT,
            sessionid  TEXT
        )`)



        db.run(`CREATE TABLE IF NOT EXISTS "login_likes_post" (
            id           INTEGER PRIMARY KEY,
            login_id     INTEGER NOT NULL,
            post_id      INTEGER NOT NULL,
            acknowledged BOOLEAN DEFAULT 0
        )`)



        db.run(`CREATE TABLE IF NOT EXISTS "saved" (
            id       INTEGER PRIMARY KEY,
            code     TEXT NOT NULL,
            login_id INTEGER NOT NULL
        )`)



        db.run(`CREATE TABLE IF NOT EXISTS "queue" (
            id       INTEGER PRIMARY KEY,
            login_id INTEGER,
            type     TEXT NOT NULL,
            content  TEXT,
            priority BOOLEAN DEFAULT 0
        )`)



        db.run(`CREATE TABLE IF NOT EXISTS "subscription" (
            id         INTEGER PRIMARY KEY,
            user_id    INTEGER NOT NULL,
            login_id   INTEGER NOT NULL,
            profile    BOOLEAN DEFAULT 0,
            story      BOOLEAN DEFAULT 0,
            posts      BOOLEAN DEFAULT 0,
            interval   INTEGER DEFAULT 84600000,
            last_check INTEGER DEFAULT 0
        )`)



        db.run(`CREATE TABLE IF NOT EXISTS "follows" (
            id                 INTEGER PRIMARY KEY,
            user_id            INTEGER NOT NULL,
            login_id           INTEGER NOT NULL,
            login_follows_user BOOLEAN DEFAULT 1
        )`)



        db.run(`CREATE TABLE IF NOT EXISTS "user_relation_user" (
            id           INTEGER PRIMARY KEY,
            from_user_id INTEGER NOT NULL,
            to_user_id   INTEGER NOT NULL,
            relation     TEXT NOT NULL,
            mutual       BOOLEAN DEFAULT 0
        )`)

    })

}

module.exports = serialize