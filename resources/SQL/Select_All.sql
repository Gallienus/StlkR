SELECT
(SELECT count(*) FROM user) as "Users",
(SELECT count(*) FROM queue) as "Queue total",
(SELECT count(*) FROM queue WHERE type = "profile") as "Queue profile",
(SELECT count(*) FROM queue WHERE length(content) > 15 AND type = "post") as "Queue private",
(SELECT count(*) FROM post) as "Posts",
(SELECT count(*) FROM content) as "# of media"