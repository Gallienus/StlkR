INSERT OR IGNORE INTO queue (type, content)
SELECT "post",code
FROM post
WHERE id IN (SELECT post_id
	FROM content
	WHERE length(media_url) = 0
)
--DELETE FROM post WHERE code IN (SELECT content FROM queue)