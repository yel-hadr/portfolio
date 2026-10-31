// Blog posts index: pure data (no asset imports), so the Node build plugin (build/blog.js) can
// import it too. Each post's title, summary and body live in content/blog/<slug>/<lang>.md
// (en and fr). Pages: /blog/<slug>/ and /fr/blog/<slug>/. Newest first; posts that share a date
// keep this order. date: when the post was published on the site (YYYY-MM-DD, UTC).
// tags: not translated (product and protocol names).
export const posts = [
  // featured: listed first on /blog/ under "Deep dives", with `cover` (a file in public/) on the
  // card
  {
    slug: 'cub3d-raycasting-from-c-to-webgl',
    date: '2026-10-31',
    tags: ['C', 'MLX42', 'React Three Fiber'],
    featured: true,
    cover: '/blog-media/cub3d-raycasting-from-c-to-webgl/cub3d-demo.webp',
  },
  {
    slug: 'fdf-isometric-projection-and-memory',
    date: '2026-10-31',
    tags: ['C', 'MiniLibX', 'three.js'],
    featured: true,
    cover: '/blog-media/fdf-isometric-projection-and-memory/julia-file-colors.webp',
  },
  {
    slug: 'pgbouncer-transaction-pooling-django-tenants',
    date: '2026-10-21',
    tags: ['PostgreSQL', 'PgBouncer', 'django-tenants'],
  },
  {
    slug: 'argo-cd-automated-sync-prune-self-heal',
    date: '2026-10-21',
    tags: ['Argo CD', 'GitOps', 'Kubernetes'],
  },
  {
    slug: 'vxlan-mtu-overhead',
    date: '2026-10-21',
    tags: ['VXLAN', 'BGP EVPN', 'MTU'],
  },
  {
    slug: 'terraform-s3-state-locking-without-dynamodb',
    date: '2026-10-21',
    tags: ['Terraform', 'AWS S3'],
  },
  {
    slug: 'loki-json-logs-and-labels',
    date: '2026-10-21',
    tags: ['Loki', 'LogQL', 'Python'],
  },
  {
    slug: 'tmux-keeps-work-alive-over-ssh',
    date: '2026-10-21',
    tags: ['tmux', 'SSH'],
  },
];
