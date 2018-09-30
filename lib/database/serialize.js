// database structure

function serialize(db) {

    db.serialize(() => {
        
        db.run(`CREATE TABLE IF NOT EXISTS "user" (
            id                   INTEGER PRIMARY KEY,
            username             TEXT UNIQUE NOT NULL,
            real_name            TEXT,
            biography            TEXT,
            webpage              TEXT,
            is_private           BOOLEAN,
            other_data           TEXT,
            post_count           INTEGER,
            followers_count      INTEGER,
            following_count      INTEGER,
            still_exists         BOOLEAN DEFAULT 1,
            download_all_posts   BOOLEAN DEFAULT 0,
            instagram_id         INTEGER
        )`)
        // json            TEXT
    
        db.run(`CREATE TABLE IF NOT EXISTS "post" (
            id                INTEGER PRIMARY KEY,
            code              TEXT UNIQUE NOT NULL,
            user_id           INTEGER NOT NULL,
            uploaded          INTEGER,
            comment_count     INTEGER,
            like_count        INTEGER,
            caption           TEXT,
            still_exists      BOOLEAN,
            other_data        TEXT,
            saved_content     BOOLEAN DEFAULT 0
        )`)
        // display_src       TEXT NOT NULL,
        // is_video          BOOLEAN DEFAULT false,
        // video_url         TEXT,
    
        db.run(`CREATE TABLE IF NOT EXISTS "content" (
            id               INTEGER PRIMARY KEY,
            post_id          INTEGER NOT NULL,
            user_id          INTEGER,
            is_video         BOOLEAN DEFAULT 0,
            media_url        TEXT,
            preview_url      TEXT,
            image_hash       TEXT,
            stored_locally   BOOLEAN DEFAULT 0,
            media_filename   TEXT,
            preview_filename TEXT,
            view_count       INTEGER
        )`)
    
        // profile, post, content
        db.run(`CREATE TABLE IF NOT EXISTS "queue" (
            id       INTEGER PRIMARY KEY,
            type     TEXT NOT NULL,
            content  TEXT UNIQUE NOT NUlL,
            priority BOOLEAN DEFAULT 0
        )`)
    
        db.run(`CREATE TABLE IF NOT EXISTS "saved" (
            id   INTEGER PRIMARY KEY,
            code TEXT UNIQUE NOT NULL
        )`)
    
        db.run(`CREATE TABLE IF NOT EXISTS "age" (
            user_id  INTEGER PRIMARY KEY,
            birthday_start INTEGER NOT NULL,
            birthday_stop  INTEGER
        )`)
        
        db.run(`CREATE TABLE IF NOT EXISTS "user_tag" (
            id      INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            tag     TEXT NOT NULL
        )`)
    
        db.run(`CREATE TABLE IF NOT EXISTS "profile_pic" (
            id       INTEGER PRIMARY KEY,
            user_id  INTEGER,
            url      TEXT,
            filename TEXT
        )`)
    
        db.run(`CREATE TABLE IF NOT EXISTS "cookie" (
            id         INTEGER PRIMARY KEY,
            session_id TEXT NOT NULL,
            ds_user_id TEXT NOT NULL,
            login      TEXT
        )`)
    
        db.run(`CREATE TABLE IF NOT EXISTS "story" (
            id               INTEGER PRIMARY KEY,
            user_id          INTEGER NOT NULL,
            uploaded         INTEGER,
            is_video         BOOLEAN DEFAULT 0,
            preview_url      TEXT,
            media_url        TEXT,
            preview_filename TEXT UNIQUE,
            media_filename   TEXT UNIQUE
        )`)
    
        db.run(`CREATE TABLE IF NOT EXISTS "user_relation" (
            id           INTEGER PRIMARY KEY,
            from_user_id INTEGER NOT NULL,
            to_user_id   INTEGER NOT NULL,
            relation     TEXT NOT NULL,
            mutual       BOOLEAN DEFAULT 0
        )`)
    
        db.run(`CREATE TABLE IF NOT EXISTS "story_subscription" (
            user_id    INTEGER PRIMARY KEY,
            interval   INTEGER DEFAULT 84600000,
            last_check INTEGER DEFAULT 0
        )`)
    })

}

module.exports = serialize