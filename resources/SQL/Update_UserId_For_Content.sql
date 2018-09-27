UPDATE content SET user_id = (
	SELECT user_id FROM post WHERE id = content.post_id
)