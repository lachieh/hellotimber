import { createFileRoute, notFound } from "@tanstack/react-router";
import { PostPage } from "../../writing/PostPage";
import { postBySlug } from "../../writing/posts";
import { postHead } from "../../seo";

/** A post (plan 32 D10, D16): the reading layout, without the phone. */
export const Route = createFileRoute("/writing/$slug")({
  loader: ({ params }) => {
    const post = postBySlug(params.slug);
    if (post === undefined) throw notFound();
    return post;
  },
  head: ({ loaderData }) => (loaderData === undefined ? {} : postHead(loaderData)),
  component: PostRoute,
});

function PostRoute() {
  return <PostPage post={Route.useLoaderData()} />;
}
