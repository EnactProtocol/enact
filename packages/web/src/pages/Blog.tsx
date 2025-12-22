import { Calendar, Tag, User } from "lucide-react";
import { Link } from "react-router-dom";
import { getAllBlogPosts } from "../data/blogPosts";

export default function Blog() {
  const blogPosts = getAllBlogPosts();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Blog</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Updates, tutorials, and insights about the Enact protocol and ecosystem.
        </p>
      </div>

      {/* Blog Posts Grid */}
      <div className="max-w-4xl mx-auto">
        {blogPosts.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-500">No blog posts yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {blogPosts.map((post) => (
              <article key={post.id} className="card-hover">
                <Link to={`/blog/${post.slug}`} className="block">
                  {/* Tags */}
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {post.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-md text-xs font-medium"
                        >
                          <Tag className="w-3 h-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Title */}
                  <h2 className="text-2xl font-bold text-gray-900 mb-3 hover:text-brand-blue transition-colors">
                    {post.title}
                  </h2>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      <time dateTime={post.date}>{formatDate(post.date)}</time>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      <span>{post.author}</span>
                    </div>
                  </div>

                  {/* Excerpt */}
                  <p className="text-gray-600 leading-relaxed mb-4">{post.excerpt}</p>

                  {/* Read more link */}
                  <div className="mt-4">
                    <span className="text-brand-blue font-medium hover:underline">Read more →</span>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
