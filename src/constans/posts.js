// Blog posts index: pure data (no asset imports), so the Node build plugin (build/blog.js) can
// import it too. Each post's title, summary and body live in content/blog/<slug>/<lang>.md
// (en and fr). Pages: /blog/<slug>/ and /fr/blog/<slug>/. Newest first; posts that share a date
// keep this order. date: when the post was published on the site (YYYY-MM-DD, UTC).
// tags: not translated (product and protocol names).
export const posts = [
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
