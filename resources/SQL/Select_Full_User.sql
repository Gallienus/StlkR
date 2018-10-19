SELECT
	user.*,
	(SELECT user_real_name.value FROM user_real_name WHERE user_real_name.user_id = user.id ORDER BY user_real_name.last_seen DESC LIMIT 1) as real_name,
	(SELECT count(user_real_name.value) FROM user_real_name WHERE user_real_name.user_id = user.id) as real_name_count,
	(SELECT user_profile_picture.filename FROM user_profile_picture WHERE user_profile_picture.user_id = user.id AND user_profile_picture.filename IS NOT NULL ORDER BY user_profile_picture.last_seen DESC LIMIT 1) as profile_picture,
	(SELECT count(user_profile_picture.filename) FROM user_profile_picture WHERE user_profile_picture.user_id = user.id) as profile_picture_count,
	(SELECT user_biography.value FROM user_biography WHERE user_biography.user_id = user.id ORDER BY user_biography.last_seen DESC LIMIT 1) as biography,
	(SELECT count(user_biography.value) FROM user_biography WHERE user_biography.user_id = user.id) as biography_count,
	(SELECT user_web_page.value FROM user_web_page WHERE user_web_page.user_id = user.id ORDER BY user_web_page.last_seen DESC LIMIT 1) as web_page,
	(SELECT count(user_web_page.value) FROM user_web_page WHERE user_web_page.user_id = user.id) as web_page_count,
	(SELECT count(post.id) FROM post WHERE post.user_id = user.id AND saved_content = 1) as posts_in_db,
	(SELECT count(story.id) FROM story WHERE story.user_id = user.id) as stories_in_db,
	GROUP_CONCAT((SELECT user_tag.value FROM user_tag WHERE user_tag.user_id = user.id)) as tags,
	GROUP_CONCAT((SELECT user_other.value FROM user_other WHERE user_other.user_id = user.id)) as others,
	GROUP_CONCAT((SELECT login.username FROM login WHERE login.id IN (SELECT subscription.login_id FROM subscription WHERE subscription.user_id = user.id))) as subscribed_by,
	user_age.birthday_start,
	user_age.birthday_stop
FROM user
LEFT JOIN user_age ON user_age.user_id = user.id
WHERE ${what} = ?