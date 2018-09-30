# Instagram

## Usage:
```
const instagram = require('instagram')
```

#### instagram.login(username, password) → Promise<Cookies>
Requests a new login session for username:password. The object returned from the promise should be used as the `cookies` argument for other functions. You should store `cookies` in a database to avoid having to call this function every time you run your application. `cookies` is the two http cookies "sessionsid" and "ds_user_id" used by instagram to recognize user sessions. The object looks like the following:

```
{
    sessionid: <string>,
    ds_user_id: <string>
}
```
Example of cookies object:
```json
{
    "sessionid": "IGS213adbcd686aa2622f17d776d8566d4456c44a4d8d443d5897c%3A5vNpwsshqYUxibVGuIDTEG1VUbV9byTz%3A%7B%22_auth_user_id%22%333444555%2C%22_auth_user_backend%22%3A%22accounts.backends.CaseInsensitiveModelBackend%22%2C%22_auth_user_hash%22%3A%22%22%2C%22_platform%22%3A4%2C%22_token_ver%22%3A2%2C%22_token%22%3A%333444555%3A3ngAFGnsdhNrti8934ngnaldfxe0nAZvoguQgtyx%3Ade6afadf6c12b2a8f3fasdfaacaa2622f17d77ac95170c2312a3ad4a34332314207b%22%2C%22last_refreshed%22%3A15365419832.15976452124%7D",
    "ds_user_id": "333444555"
}
```


#### instagram.getUser(username, cookies) → Promise<UserData>
Fetches data about a user such as number of followers, biography, profile picture, etc. `UserData` is an object containing the data.

- `username` is the username of the user.
- `cookies` is the object returned from `instagram.login`.

#### instagram.getPost(code, cookies) → Promise<PostData>
Fetches data about a post such as likes, image/video url:s, mentions, etc. `PostData` is an object containing the data.

- `code` is the post shortcode. (Eg. BoVMRzZlwWg)
- `cookies` is the object returned from `instagram.login`.

#### instagram.getStories(username, cookies, [userId]) → Promise<Stories>
Fetches story data such as upload datetime, location, image/video url:s, etc. from a user. `Stories` is an array of objects with data on each story.

- `username` is the username of the uploader.
- `cookies` is the object returned from `instagram.login`.
- `userId` is the instagram user id of the uploader. If not provided the function will fetch the user id from instagram based on the username.

### instagram.getUserPostsAll(username, cookies, [stopAt], [userId]) → Promise<Posts>
Fetch a list of posts from a user. `Posts` is an array of objects with data on each post. (This function will normally generate one request per 24 posts.)

- `username` is the username of the uploader.
- `cookies` is the object returned from `instagram.login`.
- `stopAt` is a post shortcode where the function should stop fetching more posts. If not provided the function will fetch all posts from a user.
- `userId` is the instagram user id of the uploader. If not provided the function will fetch the user id from instagram based on the username.

### instagram.getUserPosts(userId, cookies, [after], [amount=24]) → Promise<PostsData>
Fetch a list of posts from a user. `PostsData` is a graphql object. `PostsData.edges` is an array of the fetched posts.

- `userId` is the instagram user id of the uploader. (Can be fetched by using `instagram.getUser`.)
- `cookies` is the object returned from `instagram.login`.
- `after` is the instagram graphql hashed post after which posts should be fetched. If `after` represents post number 20 for a user, the function will return `amount` number of posts after post number 20. When null posts will be fetched from post number 1.
- `amount` is the amount of posts to fetch. Defaults to 24.

### instagram.getSavedPostsAll(cookies, [stopAt]) → Promise<Posts>
Fetch a list of the saved posts for the logged in user. `Posts` is an array of objects with data on each post. (This function will normally generate one request per 24 posts.)

- `cookies` is the object returned from `instagram.login`.
- `stopAt` is a post shortcode where the function should stop fetching more posts. If not provided the function will fetch all posts from a user.

### instagram.getSavedPosts(cookies, [after], [amount=24]) → Promise<PostsData>
Fetch a list of the saved posts for the logged in user. `PostsData` is a graphql object. `PostsData.edges` is an array of the fetched posts.

- `cookies` is the object returned from `instagram.login`.
- `after` is the instagram graphql hashed post after which posts should be fetched. If `after` represents post number 20 for a user, the function will return `amount` number of posts after post number 20. When null posts will be fetched from post number 1.
- `amount` is the amount of posts to fetch. Defaults to 24.

## Example

```javascript
const instagram = require('instagram')

instagram.login('example', 'exmpl123').then(cookies => {

    instagram.getUser('9gag', cookies).then(user => {
        console.log('9gag has', user.edge_followed_by.count, 'followers on Instagram!')

        instagram.getUserPosts(user.id, cookies, null, 1).then(posts => {
            console.log('The latest 9gag post has', posts.edges[0].node.edge_media_preview_like.count, 'likes!')
        }).catch(err => console.log('getUserPosts error:', err))

        instagram.getStories('9gag', cookies, user.id).then(stories => {
            console.log('9gag currently has', stories.length, 'stories!')
        }).catch(err => console.log('getStories error:', err))

    }).catch(err => console.log('getUser error:', err))

    instagram.getSavedPosts(cookies, null, 1).then(postsData => {
        console.log('You have', postsData.count, 'saved posts on instagram!')
    }).catch(err => console.log('getSavedPosts error:', err))

}).catch(err => console.log('login error:', err))

```