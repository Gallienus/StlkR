SELECT 
user.*,
age.birthday,
age.accuracy,
(SELECT COUNT(*) FROM post WHERE post.user_id = user.id AND post.saved_content = 1) as posts_in_db,
(SELECT COUNT(*) FROM content WHERE content.user_id = user.id) as contents_in_db
FROM user
LEFT JOIN age ON age.user_id = user.id
WHERE id = 1