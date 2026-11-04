// A post's reading layout (plan 32 D10, D16; website/DESIGN.md "Reading layout"): the catalogue's
// running head, the post's details in the index column with the way back to the phone, and the
// post in a 68ch column. No phone docks here.
import { Link } from "@tanstack/react-router";
import { RunningHead } from "../home/Home";
import { POST_BODIES } from "./bodies";
import { FIGURES } from "./figures";
import { formatDate, type Post } from "./posts";
import "../home/home.css";
import "./writing.css";

function PostDate({ date }: { date: string }) {
  return <time dateTime={date}>{formatDate(date)}</time>;
}

export function PostPage({ post }: { post: Post }) {
  const Body = POST_BODIES[post.slug]!;
  return (
    <div className="cat post" data-view="post">
      <RunningHead />
      <aside className="post-side" aria-label="About this post">
        <p className="post-back">
          <Link to="/">Back to the phone</Link>
        </p>
        <dl className="cat-specs post-details">
          <div>
            <dt>Published</dt>
            <dd>
              <PostDate date={post.date} />
            </dd>
          </div>
          {post.updated !== undefined && (
            <div>
              <dt>Updated</dt>
              <dd>
                <PostDate date={post.updated} />
              </dd>
            </div>
          )}
          <div>
            <dt>Reading</dt>
            <dd>{post.minutes} min</dd>
          </div>
          <div>
            <dt>In</dt>
            <dd>
              <Link to="/writing">Writing</Link>
            </dd>
          </div>
        </dl>
      </aside>
      <main className="cat-main post-main">
        <article className="post-article">
          <header className="post-header">
            <h1 className="cat-display">{post.title}</h1>
            <p className="cat-standfirst">{post.summary}</p>
          </header>
          <div className="post-body">
            <Body components={FIGURES} />
          </div>
          <footer className="post-foot">
            <p>
              <Link to="/">Back to the phone</Link> · <Link to="/writing">More writing</Link> ·{" "}
              <a href="/rss.xml">RSS</a>
            </p>
          </footer>
        </article>
      </main>
    </div>
  );
}
