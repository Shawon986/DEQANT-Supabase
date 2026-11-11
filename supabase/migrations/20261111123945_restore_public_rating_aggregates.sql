-- Keep only aggregate rating information public while protecting individual user ratings.
-- The view owner can read the base table; the view exposes product-level counts and averages only.
alter view public.product_rating_summary set (security_invoker=false);
