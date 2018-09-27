SELECT 
*,
(SELECT username FROM user WHERE user.id = post.user_id) as uploader,
(SELECT count(*) FROM content WHERE content.post_id = post.id) as contents_in_db
FROM post
WHERE id = 1