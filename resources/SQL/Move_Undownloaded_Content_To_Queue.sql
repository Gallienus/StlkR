INSERT INTO queue (type, content)
	SELECT "downloadContent", id FROM content WHERE post_id IN (
		SELECT id FROM post WHERE user_id = 195
	)