SELECT username FROM user WHERE id IN (
	SELECT DISTINCT user_id FROM post WHERE caption LIKE '%@chance_loves_swim%'
)