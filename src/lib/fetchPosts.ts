export type Post = {
  id: string;
  title: string;
  url: string;
  permalink: string;
  subreddit: string;
  author: string;
  createdUtc: number;
  score: number;
  comments: number;
  thumb?: string;
  isVideo?: boolean;
  domain?: string;
};
